import { parseFeed } from 'podcast-partytime';
import { firebaseGenerateAccessToken, NotificationsService } from 'podverse-external-services';
import { logError, logger, request, timerManager } from 'podverse-helpers';
import { ChannelService, ChannelSeasonService, FeedLogService, FeedService, checkIfFeedFlagStatusShouldParse,
  AccountFCMDeviceService, ItemService } from 'podverse-orm';
import { config } from '@parser/config';
import { handleNewItemsNotifications, handleNewLiveItemsNotifications } from '@parser/lib/notifications';
import { handleParsedChannel } from "@parser/lib/rss/channel/channel";
import { handleParsedChannelSeasons } from '@parser/lib/rss/channel/channelSeason';
import { handleRequestRSSFeed, handleParsedFeed, handleGetRSSFeed } from '@parser/lib/rss/feed/feed';
import { handleParsedItems, HandleParsedItemsResult } from '@parser/lib/rss/item/item';
import { handleParsedLiveItems, HandleParsedLiveItemsResult } from '@parser/lib/rss/liveItem/liveItem';
import { handleAllRemoteItemsFeedParsing } from '@parser/lib/rss/remoteItemParser';

/*
  NOTE: All RSS feeds that have a podcast_index_id will be saved to the database.
  RSS feeds without podcast_index_id (Add By RSS feeds) will NOT be saved to the database.
*/

// TEMP: exists for development purposes
export const parseAllRSSFeeds = async () => {
  const feedService = new FeedService();
  const feeds = await feedService.getAll();
  for (const feed of feeds) {
    return await parseRSSFeedAndSaveToDatabase(feed.url, feed?.channel?.podcast_index_id);
  }
};

export const getAndParseRSSFeed = async (url: string) => {
  const xml: string = await request(url);
  const parsedFeed = parseFeed(xml, { allowMissingGuid: true });

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

export const parseRSSFeedAndSaveToDatabase = async (url: string, podcast_index_id: number) => {
  const feedService = new FeedService();
  let feed = null;
  let channel = null;

  const timerFullRunLabel = `parseRSSFeedAndSaveToDatabase ${url} ${podcast_index_id}`;
  timerManager.start(timerFullRunLabel);

  try {

    logger.info(`parseRSSFeedAndSaveToDatabase ${url} ${podcast_index_id}`);
    feed = await handleGetRSSFeed(url, podcast_index_id);

    if (!checkIfFeedFlagStatusShouldParse(feed.feed_flag_status.id)) {
      throw new Error(`parseRSSFeedAndSaveToDatabase: feed_flag_status.status is not None or AlwaysAllow for ${feed.id} ${feed.channel.podcast_index_id} ${feed.url}`);
    }

    const parsedFeed = await handleRequestRSSFeed(feed);
    feed = await handleParsedFeed(parsedFeed, feed);
    await feedService.update(feed.id, { is_parsing: new Date() });

    const channelService = new ChannelService();
    channel = await channelService.getOrCreateByPodcastIndexId({ feed, podcast_index_id });
    
    await handleParsedChannelSeasons(parsedFeed, channel);
    const channelSeasonService = new ChannelSeasonService();
    const channelSeasonIndex = await channelSeasonService.getChannelSeasonIndex(channel);

    await handleParsedChannel(parsedFeed, channel, channelSeasonIndex);

    logger.info(`item count: ${parsedFeed.items.length}`);

    const newItemIdentifiers: HandleParsedItemsResult = await handleParsedItems(parsedFeed.items, channel, channelSeasonIndex);
    let newLiveItemIdentifiers: HandleParsedLiveItemsResult = { newItemGuids: [] };

    if (parsedFeed.podcastLiveItems) {
      newLiveItemIdentifiers = await handleParsedLiveItems(parsedFeed.podcastLiveItems, channel, channelSeasonIndex);
    }

    if (newItemIdentifiers.newItemGuids.length > 0 || newLiveItemIdentifiers.newItemGuids.length > 0) {
      const googleAuthToken = await firebaseGenerateAccessToken();
      const notificationsService = new NotificationsService({ googleAuthToken });
      const accountFCMDeviceService = new AccountFCMDeviceService();
      const itemService = new ItemService();
      
      if (newItemIdentifiers.newItemGuids.length > 0) {
        await handleNewItemsNotifications(newItemIdentifiers, channel, notificationsService, accountFCMDeviceService, itemService);
      }

      if (newLiveItemIdentifiers.newItemGuids.length > 0) {
        await handleNewLiveItemsNotifications(newLiveItemIdentifiers, channel, notificationsService, accountFCMDeviceService, itemService);
      }
    }

    const feedLogService = new FeedLogService();
    await feedLogService.update(feed, { last_finished_parse_time: new Date() });
  } catch (error) {
    logError('parseRSSFeedAndSaveToDatabase', error as Error);
  } finally {
    timerManager.endAll();
    if (feed) {
      await feedService.update(feed.id, { is_parsing: null });
    }
  }

  if (config.nodeEnv === 'production') {
    if (channel) {
      await handleAllRemoteItemsFeedParsing(channel);
    }
  }

  return;
};

