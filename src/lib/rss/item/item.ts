import { Episode } from "podcast-partytime";
import { chunkArray, DATABASE_CONSTANTS, logger, timerManager } from "podverse-helpers";
import { AppDataSource, Channel, ChannelSeasonIndex, EntityManager, ItemService } from "podverse-orm";
import { compatItemDto } from "@parser/lib/compat/partytime/item";
import { handleParsedItemAbout } from "@parser/lib/rss/item/itemAbout";
import { handleParsedItemChaptersFeed } from "@parser/lib/rss/item/itemChaptersFeed";
import { handleParsedItemDescription } from "@parser/lib/rss/item/itemDescription";
import { handleParsedItemEnclosure } from "@parser/lib/rss/item/itemEnclosure";
import { handleParsedItemImage } from "@parser/lib/rss/item/itemImage";
import { handleParsedItemLicense } from "@parser/lib/rss/item/itemLicense";
import { handleParsedItemLocation } from "@parser/lib/rss/item/itemLocation";
import { handleParsedItemPerson } from "@parser/lib/rss/item/itemPerson";
import { handleParsedItemSeason } from "@parser/lib/rss/item/itemSeason";
import { handleParsedItemSeasonEpisode } from "@parser/lib/rss/item/itemSeasonEpisode";
import { handleParsedItemSocialInteract } from "@parser/lib/rss/item/itemSocialInteract";
import { handleParsedItemSoundbite } from "@parser/lib/rss/item/itemSoundbite";
import { handleParsedItemTranscript } from "@parser/lib/rss/item/itemTranscript";
import { handleParsedItemTxt } from "@parser/lib/rss/item/itemTxt";
import { handleParsedItemValue } from "@parser/lib/rss/item/itemValue";
import { handleParsedItemChat } from "@parser/lib/rss/item/itemChat";
import { config } from "@parser/config";

const removeDuplicates = (parsedItems: Episode[]): Episode[] => {
  const seen = new Set<string>();
  return parsedItems.reduce((acc, item) => {
    const enclosureUrl = item.enclosure.url.slice(0, DATABASE_CONSTANTS.varchar_url);
    if (!seen.has(enclosureUrl)) {
      seen.add(enclosureUrl);
      acc.push(item);
    }
    return acc;
  }, [] as Episode[]);
};

type ItemTimerAccumulator = {
  updateItem: number;
  handleParsedItemAbout: number;
  handleParsedItemChaptersFeed: number;
  handleParsedItemChat: number;
  handleParsedItemDescription: number;
  handleParsedItemEnclosure: number;
  handleParsedItemImage: number;
  handleParsedItemLicense: number;
  handleParsedItemLocation: number;
  handleParsedItemPerson: number;
  handleParsedItemSeason: number;
  handleParsedItemSeasonEpisode: number;
  handleParsedItemSocialInteract: number;
  handleParsedItemSoundbite: number;
  handleParsedItemTranscript: number;
  handleParsedItemTxt: number;
  handleParsedItemValue: number;
};

type HandleParsedItemBatch = {
  parsedItemBatch: Episode[]
  channel: Channel
  channelSeasonIndex: ChannelSeasonIndex
  transactionalEntityManager?: EntityManager
  updatedItemIds: number[]
  timerAccumulator: ItemTimerAccumulator
};

type HandleParsedItem = {
  parsedItem: Episode
  channel: Channel
  channelSeasonIndex: ChannelSeasonIndex
  transactionalEntityManager?: EntityManager
  timerAccumulator: ItemTimerAccumulator
};

export const createItemTimerAccumulator = (): ItemTimerAccumulator => {
  const timerAccumulator: ItemTimerAccumulator = {
    updateItem: 0,
    handleParsedItemAbout: 0,
    handleParsedItemChaptersFeed: 0,
    handleParsedItemChat: 0,
    handleParsedItemDescription: 0,
    handleParsedItemEnclosure: 0,
    handleParsedItemImage: 0,
    handleParsedItemLicense: 0,
    handleParsedItemLocation: 0,
    handleParsedItemPerson: 0,
    handleParsedItemSeason: 0,
    handleParsedItemSeasonEpisode: 0,
    handleParsedItemSocialInteract: 0,
    handleParsedItemSoundbite: 0,
    handleParsedItemTranscript: 0,
    handleParsedItemTxt: 0,
    handleParsedItemValue: 0
  };
  return timerAccumulator;
};

export const handleParsedItems = async (parsedItems: Episode[], channel: Channel, channelSeasonIndex: ChannelSeasonIndex) => {
  const itemService = new ItemService();

  timerManager.start('getAllItemsByChannel');
  const existingItems = await itemService.getAllItemsByChannel(channel, { select: ['id'] });
  timerManager.end('getAllItemsByChannel');

  timerManager.start('existingItemIds');
  const existingItemIds = existingItems.map(item => item.id);
  const updatedItemIds: number[] = [];

  const uniqueParsedItems = removeDuplicates(parsedItems);
  const parsedItemBatchs = chunkArray(uniqueParsedItems, 100);

  const timerAccumulator = createItemTimerAccumulator();
  timerManager.end('existingItemIds');

  for (const parsedItemBatch of parsedItemBatchs) {
    timerManager.start('handleParsedItemBatch');
    if (config.shouldLogTimer) {
      await handleParsedItemBatch({
        parsedItemBatch,
        channel,
        channelSeasonIndex,
        updatedItemIds,
        timerAccumulator
      });
    } else {
      await AppDataSource.manager.transaction(async transactionalEntityManager => {
        await handleParsedItemBatch({
          parsedItemBatch,
          channel,
          channelSeasonIndex,
          transactionalEntityManager,
          updatedItemIds,
          timerAccumulator
        });
      });
    }
    timerManager.end('handleParsedItemBatch');
  }

  if (config.shouldLogTimer) {
    Object.entries(timerAccumulator).forEach(([key, value]) => {
      logger.info(`${key} took ${value}ms`);
    });
  }

  const itemIdsToDelete = existingItemIds.filter(id => !updatedItemIds.includes(id));
  await itemService.deleteMany(itemIdsToDelete);
};

const handleParsedItemBatch = async ({
  parsedItemBatch,
  channel,
  channelSeasonIndex,
  transactionalEntityManager,
  updatedItemIds,
  timerAccumulator
}: HandleParsedItemBatch) => {
  for (const parsedItem of parsedItemBatch) {
    const item = await handleParsedItem({
      parsedItem,
      channel,
      channelSeasonIndex,
      transactionalEntityManager,
      timerAccumulator
    });
    updatedItemIds.push(item.id);
  }
};

export const handleParsedItem = async ({
  parsedItem,
  channel,
  channelSeasonIndex,
  transactionalEntityManager,
  timerAccumulator
}: HandleParsedItem) => {
  const itemService = new ItemService();
  const itemDto = compatItemDto(parsedItem);
  
  timerManager.start('updateItem');
  const item = await itemService.update(channel, itemDto);
  timerAccumulator.updateItem = timerManager.end('updateItem', true) + timerAccumulator.updateItem;

  const preventTimerLog = true;

  timerManager.start('handleParsedItemAbout');
  await handleParsedItemAbout(parsedItem, item, transactionalEntityManager);
  timerAccumulator.handleParsedItemAbout = timerManager.end('handleParsedItemAbout', preventTimerLog) + timerAccumulator.handleParsedItemAbout;

  timerManager.start('handleParsedItemChapterFeed');
  await handleParsedItemChaptersFeed(parsedItem, item, transactionalEntityManager);
  timerAccumulator.handleParsedItemChaptersFeed = timerManager.end('handleParsedItemChapterFeed', preventTimerLog) + timerAccumulator.handleParsedItemChaptersFeed;

  timerManager.start('handleParsedItemChat');
  await handleParsedItemChat(parsedItem, item, transactionalEntityManager);
  timerAccumulator.handleParsedItemChat = timerManager.end('handleParsedItemChat', preventTimerLog) + timerAccumulator.handleParsedItemChat;

  // // PTDO: add itemContentLinkService support after partytime adds chat support
  // const itemContentLinkService = new ItemContentLinkService();
  // const itemContentLinkDtos = compatItemContentLinkDtos(parsedItem);
  // if (itemContentLinkDtos.length) {
  //   await itemContentLinkService.updateMany(item, itemContentLinkDtos);
  // } else {
  //   await itemContentLinkService._deleteAll(item);
  // }

  timerManager.start('handleParsedItemDescription');
  await handleParsedItemDescription(parsedItem, item, transactionalEntityManager);
  timerAccumulator.handleParsedItemDescription = timerManager.end('handleParsedItemDescription', preventTimerLog) + timerAccumulator.handleParsedItemDescription;

  timerManager.start('handleParsedItemEnclosure');
  await handleParsedItemEnclosure(parsedItem, item, transactionalEntityManager);
  timerAccumulator.handleParsedItemEnclosure = timerManager.end('handleParsedItemEnclosure', preventTimerLog) + timerAccumulator.handleParsedItemEnclosure;

  timerManager.start('handleParsedItemImage');
  await handleParsedItemImage(parsedItem, item, transactionalEntityManager);
  timerAccumulator.handleParsedItemImage = timerManager.end('handleParsedItemImage', preventTimerLog) + timerAccumulator.handleParsedItemImage;

  timerManager.start('handleParsedItemLicense');
  await handleParsedItemLicense(parsedItem, item, transactionalEntityManager);
  timerAccumulator.handleParsedItemLicense = timerManager.end('handleParsedItemLicense', preventTimerLog) + timerAccumulator.handleParsedItemLicense;

  timerManager.start('handleParsedItemLocation');
  await handleParsedItemLocation(parsedItem, item, transactionalEntityManager);
  timerAccumulator.handleParsedItemLocation = timerManager.end('handleParsedItemLocation', preventTimerLog) + timerAccumulator.handleParsedItemLocation;

  timerManager.start('handleParsedItemPerson');
  await handleParsedItemPerson(parsedItem, item, transactionalEntityManager);
  timerAccumulator.handleParsedItemPerson = timerManager.end('handleParsedItemPerson', preventTimerLog) + timerAccumulator.handleParsedItemPerson;
  
  timerManager.start('handleParsedItemSeason');
  await handleParsedItemSeason(parsedItem, item, channelSeasonIndex, transactionalEntityManager);
  timerAccumulator.handleParsedItemSeason = timerManager.end('handleParsedItemSeason', preventTimerLog) + timerAccumulator.handleParsedItemSeason;
  
  timerManager.start('handleParsedItemSeasonEpisode');
  await handleParsedItemSeasonEpisode(parsedItem, item, transactionalEntityManager);
  timerAccumulator.handleParsedItemSeasonEpisode = timerManager.end('handleParsedItemSeasonEpisode', preventTimerLog) + timerAccumulator.handleParsedItemSeasonEpisode;

  timerManager.start('handleParsedItemSocialInteract');
  await handleParsedItemSocialInteract(parsedItem, item, transactionalEntityManager);
  timerAccumulator.handleParsedItemSocialInteract = timerManager.end('handleParsedItemSocialInteract', preventTimerLog) + timerAccumulator.handleParsedItemSocialInteract;

  timerManager.start('handleParsedItemSoundbite');
  await handleParsedItemSoundbite(parsedItem, item, transactionalEntityManager);
  timerAccumulator.handleParsedItemSoundbite = timerManager.end('handleParsedItemSoundbite', preventTimerLog) + timerAccumulator.handleParsedItemSoundbite;

  timerManager.start('handleParsedItemTranscript');
  await handleParsedItemTranscript(parsedItem, item, transactionalEntityManager);
  timerAccumulator.handleParsedItemTranscript = timerManager.end('handleParsedItemTranscript', preventTimerLog) + timerAccumulator.handleParsedItemTranscript;

  timerManager.start('handleParsedItemTxt');
  await handleParsedItemTxt(parsedItem, item, transactionalEntityManager);
  timerAccumulator.handleParsedItemTxt = timerManager.end('handleParsedItemTxt', preventTimerLog) + timerAccumulator.handleParsedItemTxt;

  timerManager.start('handleParsedItemValue');
  await handleParsedItemValue(parsedItem, item, channel, transactionalEntityManager);
  timerAccumulator.handleParsedItemValue = timerManager.end('handleParsedItemValue', preventTimerLog) + timerAccumulator.handleParsedItemValue;

  return item;
};
