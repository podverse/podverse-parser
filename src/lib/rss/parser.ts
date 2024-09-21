import { parseFeed } from 'podcast-partytime';
import { logError, logger, request, timerManager } from 'podverse-helpers';
import { ChannelService, ChannelSeasonService, FeedLogService, FeedService } from 'podverse-orm';
import { handleParsedChannel } from "@parser/lib/rss/channel/channel";
import { handleParsedItems } from './item/item';
import { handleParsedChannelSeasons } from './channel/channelSeason';
import { handleParsedLiveItems } from './liveItem/liveItem';
import { handleRequestRSSFeed, handleParsedFeed, handleGetRSSFeed } from './feed/feed';
import { handleAllRemoteItemsFeedParsing } from './remoteItemParser';

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
  
  try {
    logger.info(`parseRSSFeedAndSaveToDatabase ${url} ${podcast_index_id}`);
    feed = await handleGetRSSFeed(url, podcast_index_id);
    
    const parsedFeed = await handleRequestRSSFeed(feed);
    feed = await handleParsedFeed(parsedFeed, feed);
    await feedService.update(feed.id, { is_parsing: new Date() });
    
    const channelService = new ChannelService();
    channel = await channelService.getOrCreateByPodcastIndexId({ feed, podcast_index_id });
    
    // ChannelSeason must be parsed before anything else, because the channel season rows
    // need to be created for other data to have a foreign key to them.
    await handleParsedChannelSeasons(parsedFeed, channel);
    const channelSeasonService = new ChannelSeasonService();
    const channelSeasonIndex = await channelSeasonService.getChannelSeasonIndex(channel);
    
    await handleParsedChannel(parsedFeed, channel, channelSeasonIndex);
    
    logger.info(`item count: ${parsedFeed.items.length}`);
    // PTDO: if publisher feed, handle publisher remote item data
    // else handle parsed items
    await handleParsedItems(parsedFeed.items, channel, channelSeasonIndex);
  
    if (parsedFeed.podcastLiveItems) {
      await handleParsedLiveItems(parsedFeed.podcastLiveItems, channel, channelSeasonIndex);
    }
    
    // // TODO: handle new item notifications
    
    // // TODO: handle new live_item notifications
    
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

  if (channel) {
    await handleAllRemoteItemsFeedParsing(channel);
  }

  return;
};

