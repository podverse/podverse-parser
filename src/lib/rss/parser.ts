import { parseFeed } from 'podcast-partytime';
import { logger, request } from 'podverse-helpers';
import { ChannelService, ChannelSeasonService, FeedLogService, FeedService } from 'podverse-orm';
import { handleParsedChannel } from "@parser/lib/rss/channel/channel";
import { handleParsedItems } from './item/item';
import { handleParsedChannelSeasons } from './channel/channelSeason';
import { handleParsedLiveItems } from './liveItem/liveItem';
import { handleGetRSSFeed, handleParsedFeed } from './feed/feed';

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
  logger.info(`parseRSSFeedAndSaveToDatabase ${url} ${podcast_index_id}`);
  const feedService = new FeedService();

  let feed = await feedService.getByUrlAndPodcastIndexId({ url, podcast_index_id });
  
  if (!feed) {
    feed = await feedService.getByPodcastIndexId({ podcast_index_id });
    if (feed) {
      feed.url = url;
      await feedService.update(feed.id, { url });
    }
  }

  // TODO: we may not want to create feeds in this helper in production
  // but i'm adding it here for stage testing.
  if (!feed) {
    feed = await feedService.getOrCreate({ url, podcast_index_id });
  }

  if (!feed) {
    throw new Error(`parseRSSFeedAndSaveToDatabase: feed not found for ${url}`);
  }

  const parsedFeed = await handleGetRSSFeed(feed);
  logger.info(`item count: ${parsedFeed.items.length}`);
  feed = await handleParsedFeed(parsedFeed, feed);
  
  try {
    await feedService.update(feed.id, { is_parsing: new Date() });

    const channelService = new ChannelService();
    const channel = await channelService.getOrCreateByPodcastIndexId({ feed, podcast_index_id });
  
    // ChannelSeason must be parsed before anything else, because the channel season rows
    // need to be created for other data to have a foreign key to them.
    await handleParsedChannelSeasons(parsedFeed, channel);
    const channelSeasonService = new ChannelSeasonService();
    const channelSeasonIndex = await channelSeasonService.getChannelSeasonIndex(channel);
    
    await handleParsedChannel(parsedFeed, channel, channelSeasonIndex);
  
    // PTDO: if publisher feed, handle publisher remote item data
    // else handle parsed items
    await handleParsedItems(parsedFeed.items, channel, channelSeasonIndex);
  
    if (parsedFeed.podcastLiveItems) {
      await handleParsedLiveItems(parsedFeed.podcastLiveItems, channel, channelSeasonIndex);
    }
  
    // TODO: handle new item notifications
    
    // TODO: handle new live_item notifications
    
    const feedLogService = new FeedLogService();
    await feedLogService.update(feed, { last_finished_parse_time: new Date() });
  } catch (error) {
    const err = error as Error;
    logger.error('parseRSSFeedAndSaveToDatabase error:', err.stack);
    throw err;
  } finally {
    await feedService.update(feed.id, { is_parsing: null });
  }

  return feed;
};
