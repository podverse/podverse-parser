import { parseFeed } from 'podcast-partytime';
import { ChannelService, ChannelSeasonService, FeedLogService, FeedService, checkIfFeedFlagStatusShouldParse,
  /* AccountFCMDeviceService, ItemService, */ checkIfSpamFeed, FeedFlagStatusStatusEnum } from 'podverse-orm';
// import { handleNewItemsNotifications, handleNewLiveItemsNotifications } from '@parser/lib/notifications';
import { handleParsedChannel } from "@parser/lib/rss/channel/channel";
import { handleParsedChannelSeasons } from '@parser/lib/rss/channel/channelSeason';
import { handleRequestRSSFeed, handleParsedFeed, handleGetRSSFeed } from '@parser/lib/rss/feed/feed';
import { handleParsedItems, HandleParsedItemsResult } from '@parser/lib/rss/item/item';
import { handleParsedLiveItems, HandleParsedLiveItemsResult } from '@parser/lib/rss/liveItem/liveItem';
import { handleAllRemoteItemsFeedParsing } from '@parser/lib/rss/remoteItemParser';
import { FeedIsParsingError, FeedNoChangesSinceLastParsedError } from './errors';
import { timerManager } from '@parser/factories/timerManager';
import { loggerService } from '@parser/factories/loggerService';
// import { firebaseAccessTokenServiceFactory } from '@parser/factories/firebaseAccessTokenService';
// import { NotificationsServiceFactory } from '@parser/factories/notificationsService';
import { _request } from '../_request';

/*
  NOTE: All RSS feeds that have a podcast_index_id will be saved to the database.
  RSS feeds without podcast_index_id (Add By RSS feeds) will NOT be saved to the database.
*/

export const getAndParseRSSFeed = async (url: string) => {
  const response = await _request(url);
  const data = response.data as string;
  const parsedFeed = parseFeed(data, { allowMissingGuid: true });

  if (!parsedFeed) {
    throw new Error(`getAndParseRSSFeed: parsedFeed not found for ${url}`);
  }

  return parsedFeed;
};

// export const parseRSSAddByRSSFeed = async (url: string) => {
//   const parsedFeed = await getAndParseRSSFeed(url);
//   const compatData = convertParsedRSSFeedToCompat(parsedFeed);
//   return compatData;
// };

export type ParseRSSFeedAndSaveToDatabase = {
  forceParse?: boolean; // If true, will parse fully without checking for changes.
}

export const parseRSSFeedAndSaveToDatabase = async (
  url: string,
  podcast_index_id: number,
  options: ParseRSSFeedAndSaveToDatabase
) => {
  const feedService = new FeedService();
  let feed = null;
  let channel = null;

  const timerFullRunLabel = `parseRSSFeedAndSaveToDatabase ${url} ${podcast_index_id}`;
  timerManager.start(timerFullRunLabel);

  try {
    if (!url || !podcast_index_id) {
      throw new Error(`parseRSSFeedAndSaveToDatabase: url or podcast_index_id is missing for ${url} ${podcast_index_id}`);
    }

    loggerService.info(`parseRSSFeedAndSaveToDatabase url: ${url} podcast_index_id: ${podcast_index_id}`);
    feed = await handleGetRSSFeed(url, podcast_index_id);

    if (!checkIfFeedFlagStatusShouldParse(feed.feed_flag_status.id)) {
      throw new Error(`parseRSSFeedAndSaveToDatabase: feed_flag_status.status is not Active or AlwaysAllow for ${feed.id} ${feed.podcast_index_id} ${feed.url}`);
    }

    const parsedFeed = await handleRequestRSSFeed(feed);
    feed = await handleParsedFeed(parsedFeed, feed, options);
    await feedService.update(feed.id, { is_parsing: new Date() });
    
    if (checkIfSpamFeed(parsedFeed)) {
      await feedService.updateFlagStatus(feed, FeedFlagStatusStatusEnum.Spam);
      throw new Error(`parseRSSFeedAndSaveToDatabase: feed is spam ${feed.id} ${feed.podcast_index_id} ${feed.url}`);
    }

    const channelService = new ChannelService();
    channel = await channelService.getOrCreateByFeed(feed);
    
    await handleParsedChannelSeasons(parsedFeed, channel);
    const channelSeasonService = new ChannelSeasonService();
    const channelSeasonIndex = await channelSeasonService.getChannelSeasonIndex(channel);

    await handleParsedChannel(parsedFeed, channel, channelSeasonIndex);

    loggerService.info(`item count: ${parsedFeed.items.length}`);

    const newItemIdentifiers: HandleParsedItemsResult = await handleParsedItems(parsedFeed.items, channel, channelSeasonIndex);
    let newLiveItemIdentifiers: HandleParsedLiveItemsResult = { newItemGuids: [] };

    if (parsedFeed.podcastLiveItems) {
      newLiveItemIdentifiers = await handleParsedLiveItems(parsedFeed.podcastLiveItems, channel, channelSeasonIndex);
    }

    if (newItemIdentifiers.newItemGuids.length > 0 || newLiveItemIdentifiers.newItemGuids.length > 0) {
      // const firebaseAccessTokenService = firebaseAccessTokenServiceFactory();
      // const googleAuthToken = await firebaseAccessTokenService.generateAccessToken();
      // const notificationsService = NotificationsServiceFactory(googleAuthToken);
      // const accountFCMDeviceService = new AccountFCMDeviceService();
      // const itemService = new ItemService();
      
      // if (newItemIdentifiers.newItemGuids.length > 0) {
      //   await handleNewItemsNotifications(newItemIdentifiers, channel, notificationsService, accountFCMDeviceService, itemService);
      // }

      // if (newLiveItemIdentifiers.newItemGuids.length > 0) {
      //   await handleNewLiveItemsNotifications(newLiveItemIdentifiers, channel, notificationsService, accountFCMDeviceService, itemService);
      // }
    }

    const feedLogService = new FeedLogService();
    await feedLogService.update(feed, { last_finished_parse_time: new Date() });
  } catch (error) {
    if (error instanceof FeedIsParsingError) {
      loggerService.warn(`Feed ${feed?.id} is already parsing.`);
    } else if (error instanceof FeedNoChangesSinceLastParsedError) {
      loggerService.warn(`Feed ${feed?.id} has no changes since last parsed.`);
    } else {
      // TODO: Handle other errors
      loggerService.logError('parseRSSFeedAndSaveToDatabase', error as Error);
    }
  } finally {
    loggerService.info(`Finished parsing channel: ${channel?.id} ${channel?.id_text} feed: ${feed?.id} url: ${url} podcast_index_id: ${podcast_index_id}`);
    timerManager.endAll();
    if (feed) {
      await feedService.update(feed.id, { is_parsing: null });
    }
  }

  if (channel) {
    await handleAllRemoteItemsFeedParsing(channel);
  }
  
  return;
};

