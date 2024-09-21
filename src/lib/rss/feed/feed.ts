import { FeedObject } from "podcast-partytime";
import { throwRequestError, timerManager } from "podverse-helpers";
import { checkIfFeedFlagStatusShouldParse, Feed, FeedService, FeedLogService } from "podverse-orm";
import { getParsedFeedMd5Hash } from "../hash/parsedFeed";
import { getAndParseRSSFeed } from "../parser";

export const handleGetRSSFeed = async (url: string, podcast_index_id: number): Promise<Feed> => {
  timerManager.start('handleGetRSSFeed');

  const feedService = new FeedService();

  let feed = await feedService.getByUrlAndPodcastIndexId({ url, podcast_index_id });
  
  if (!feed) {
    feed = await feedService.getByPodcastIndexId({ podcast_index_id });
    if (feed) {
      feed.url = url;
      await feedService.update(feed.id, { url });
    }
  }

  if (!feed) {
    feed = await feedService.getOrCreate({ url, podcast_index_id });
  }

  timerManager.end('handleGetRSSFeed');

  if (!feed) {
    throw new Error(`parseRSSFeedAndSaveToDatabase: feed not found for ${url}`);
  }

  return feed;
};

export const handleRequestRSSFeed = async (feed: Feed): Promise<FeedObject> => {
  timerManager.start('handleRequestRSSFeed');
  const feedLogService = new FeedLogService();
  let parsedFeed: FeedObject | null = null;
  
  try {
    parsedFeed = await getAndParseRSSFeed(feed.url);
    await feedLogService.update(feed, {
      last_http_status: 200,
      last_good_http_status_time: new Date()
    });
  } catch (error) {
    // TODO: how to handle errors?
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const statusCode = (error as any).statusCode as number;
    const feedLog = await feedLogService.get(feed);
    if (statusCode) {
      await feedLogService.update(feed, {
        last_http_status: statusCode,
        parse_errors: (feedLog?.parse_errors || 0) + 1,
      });
    }
    return throwRequestError(error);
  }
  
  if (!parsedFeed) {
    const feedLog = await feedLogService.get(feed);
    await feedLogService.update(feed, {
      last_http_status: 200,
      last_finished_parse_time: new Date(),
      parse_errors: (feedLog?.parse_errors || 0) + 1,
    });
    return throwRequestError('parsedFeed no data found');
  }

  timerManager.end('handleRequestRSSFeed');

  return parsedFeed;
};

export const handleParsedFeed = async (parsedFeed: FeedObject, feed: Feed): Promise<Feed> => {
  // TODO: move before partytime parsing
  if (!checkIfFeedFlagStatusShouldParse(feed.feed_flag_status.id)) {
    throw new Error(`parseRSSFeedAndSaveToDatabase: feed_flag_status.status is not None or AlwaysAllow for ${feed.id} ${feed.channel.podcast_index_id} ${feed.url}`);
  }

  checkIfFeedIsParsing(feed);

  const currentFeedFileHash = getParsedFeedMd5Hash(parsedFeed);

  if (feed.last_parsed_file_hash === currentFeedFileHash) {
    throw new Error(`Feed ${feed.id} has no changes since last parsed.`);
  }

  const feedService = new FeedService();
  return feedService.update(feed.id, { last_parsed_file_hash: currentFeedFileHash });
};

const checkIfFeedIsParsing = (feed: Feed): void => {
  // TODO: handle with caching db / redis instead of database?
  if (feed.is_parsing) {
    const parsingDate = new Date(feed.is_parsing);
    const currentDate = new Date();
    const timeDifference = (currentDate.getTime() - parsingDate.getTime()) / (1000 * 60);
  
    if (isNaN(parsingDate.getTime())) {
      throw new Error(`Feed ${feed.id} has an invalid parsing date`);
    }
  
    if (timeDifference <= 30) {
      throw new Error(`Feed ${feed.id} is already parsing`);
    }
  }
};
