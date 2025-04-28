import { Phase4PodcastLiveItem } from "podcast-partytime/dist/parser/phase/phase-4";
import { chunkArray, logger } from "podverse-helpers";
import { AppDataSourceReadWrite, Channel, ChannelSeasonIndex, getLiveItemStatusEnumValue, ItemService, LiveItemService, LiveItemStatusEnum, LiveItem } from "podverse-orm";
import { config } from "@parser/config";
import { compatLiveItemsDtos } from "@parser/lib/compat/partytime/liveItem";
import { createItemTimerAccumulator, handleParsedItem } from "@parser/lib/rss/item/item";
import { ItemFlagStatusStatusEnum } from "podverse-orm/dist/entities/item/itemFlagStatus";

export type HandleParsedLiveItemsResult = {
  newItemGuids: string[];
};

type LiveItemObjDto = {
  item: Phase4PodcastLiveItem;
  // TODO: how to replace this any?
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  liveItem: any; // Replace with the correct type if available
};

const processLiveItemBatch = async (
  liveItemObjDtosBatch: LiveItemObjDto[],
  channel: Channel,
  channelSeasonIndex: ChannelSeasonIndex,
  existingLiveItemMap: Map<string, LiveItem>,
  updatedLiveItemIds: number[],
  newItemGuids: string[],
  transactionalEntityManager: any, 
  timerAccumulator: any,
  liveItemService: LiveItemService
) => {
  for (const liveItemObjDto of liveItemObjDtosBatch) {
    const itemDto = liveItemObjDto.item;
    
    const item = await handleParsedItem({
      parsedItem: itemDto,
      channel,
      channelSeasonIndex,
      transactionalEntityManager,
      timerAccumulator,
      isLiveItem: true
    });

    updatedLiveItemIds.push(item.id);

    const existingLiveItem = existingLiveItemMap.get(itemDto.guid);
    const itemStatusEnum = getLiveItemStatusEnumValue(itemDto.status);

    if (
      !existingLiveItem ||
      (existingLiveItem.live_item_status.id !== LiveItemStatusEnum.Ended && itemStatusEnum === LiveItemStatusEnum.Ended)
    ) {
      newItemGuids.push(itemDto.guid);
    }

    const liveItemDto = liveItemObjDto.liveItem;
    await liveItemService.update(item, liveItemDto);
  }
};

const logTimerAccumulator = (timerAccumulator: Record<string, number>) => {
  if (config.shouldLogTimer) {
    Object.entries(timerAccumulator).forEach(([key, value]) => {
      logger.info(`${key} took ${value}ms`);
    });
  }
};

export const handleParsedLiveItems = async (
  parsedLiveItems: Phase4PodcastLiveItem[],
  channel: Channel,
  channelSeasonIndex: ChannelSeasonIndex
): Promise<HandleParsedLiveItemsResult> => {
  const itemService = new ItemService();
  const liveItemService = new LiveItemService();
  const existingLiveItems = await liveItemService.getManyByChannel(channel, { relations: ['item', 'live_item_status'] });
  const existingLiveItemMap: Map<string, LiveItem> = new Map(existingLiveItems.map(live_item => [live_item.item.guid, live_item]));
  const existingLiveItemIds = existingLiveItems.map(live_item => live_item.id);
  const updatedLiveItemIds: number[] = [];
  const newItemGuids: string[] = [];
  const liveItemObjDtos = compatLiveItemsDtos(parsedLiveItems);

  const timerAccumulator = createItemTimerAccumulator();

  const liveItemObjDtosBatchs = chunkArray(liveItemObjDtos, 50);
  for (const liveItemObjDtosBatch of liveItemObjDtosBatchs) {
    await AppDataSourceReadWrite.manager.transaction(async transactionalEntityManager => {
      await processLiveItemBatch(
        liveItemObjDtosBatch,
        channel,
        channelSeasonIndex,
        existingLiveItemMap,
        updatedLiveItemIds,
        newItemGuids,
        transactionalEntityManager,
        timerAccumulator,
        liveItemService
      );
    });
  }

  logTimerAccumulator(timerAccumulator);

  const itemIdsToDelete = existingLiveItemIds.filter(id => !updatedLiveItemIds.includes(id));
  const itemsToDelete = existingLiveItems
    .filter(liveItem => itemIdsToDelete.includes(liveItem.id))
    .map(liveItem => liveItem.item);
  await itemService.updateManyFlagStatus(itemsToDelete, ItemFlagStatusStatusEnum.PendingArchive);

  return { newItemGuids };
};