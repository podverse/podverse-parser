import { request, throwRequestError } from "podverse-helpers";
import { Item, ItemChaptersFeed, ItemChapterService, ItemChaptersFeedLogService } from "podverse-orm";
import { compatParsedChapters, PIChapter } from "@parser/lib/compat/chapters/chapters";

const getParsedChapters = async (item_chapters_feed: ItemChaptersFeed) => {
  const itemChaptersFeedLogService = new ItemChaptersFeedLogService();
  try {
    const response = await request(item_chapters_feed.url);
    const data = response.data as PIChapter[];
    await itemChaptersFeedLogService.update(item_chapters_feed, {
      last_http_status: 200,
      last_good_http_status_time: new Date()
    });
    return compatParsedChapters(data);
  } catch (error) {
    // TODO: how to handle errors?
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const statusCode = (error as any).statusCode as number;
    const item_chapters_feed_log = await itemChaptersFeedLogService.get(item_chapters_feed);
    if (statusCode) {
      await itemChaptersFeedLogService.update(item_chapters_feed, {
        last_http_status: statusCode,
        parse_errors: (item_chapters_feed_log?.parse_errors || 0) + 1,
      });
    }
    return throwRequestError(error);
  }
};

export const parseChapters = async (item: Item): Promise<void> => {
  const item_chapters_feed = item.item_chapters_feed;

  if (!item_chapters_feed) {
    return;
  }

  const parsedChapters = await getParsedChapters(item_chapters_feed);
  
  const itemChapterService = new ItemChapterService();

  const existingChapters = await itemChapterService.getAll(item_chapters_feed, { select: ['id'] });
  const existingChaptersIds = existingChapters.map(item_chapter => item_chapter.id);
  const updatedChaptersIds: number[] = [];

  for (const parsedChapter of parsedChapters) {
    await itemChapterService.update(item_chapters_feed, parsedChapter);
    updatedChaptersIds.push(item_chapters_feed.id);
  }

  const itemChapterIdsToDelete = existingChaptersIds.filter(id => !updatedChaptersIds.includes(id));
  await itemChapterService.deleteMany(itemChapterIdsToDelete);

  const itemChaptersFeedLogService = new ItemChaptersFeedLogService();
  await itemChaptersFeedLogService.update(item_chapters_feed, { last_finished_parse_time: new Date() });
};
