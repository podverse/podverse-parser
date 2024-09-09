import { chunkArray } from "podverse-helpers";
import { Phase4PodcastLiveItem } from "podcast-partytime/dist/parser/phase/phase-4";
import { AppDataSource, Channel, ChannelSeasonIndex, ItemService, LiveItemService } from "podverse-orm";
import { compatLiveItemsDtos } from "@parser/lib/compat/partytime/liveItem";
import { handleParsedItem } from "../item/item";

export const handleParsedLiveItems = async (parsedLiveItems: Phase4PodcastLiveItem[], channel: Channel, channelSeasonIndex: ChannelSeasonIndex) => {
  const itemService = new ItemService();
  const existingLiveItems = await itemService.getAllItemsWithLiveItemByChannel(channel, { select: ['id'] });
  const existingLiveItemIds = existingLiveItems.map(live_item => live_item.id);
  const updatedLiveItemIds: number[] = [];
  const liveItemObjDtos = compatLiveItemsDtos(parsedLiveItems);

  const liveItemObjDtosBatchs = chunkArray(liveItemObjDtos, 50);
  for (const liveItemObjDtosBatch of liveItemObjDtosBatchs) {
    await AppDataSource.manager.transaction(async transactionalEntityManager => {
      for (const liveItemObjDto of liveItemObjDtosBatch) {
        // PTDO: how to make any unnecessary?
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const itemDto = liveItemObjDto.item as any;
    
        const item = await handleParsedItem(itemDto, channel, channelSeasonIndex, transactionalEntityManager);
        updatedLiveItemIds.push(item.id);
    
        const liveItemService = new LiveItemService();
        const liveItemDto = liveItemObjDto.liveItem;
        await liveItemService.update(item, liveItemDto);
      }
    });
  }

  const itemIdsToDelete = existingLiveItemIds.filter(id => !updatedLiveItemIds.includes(id));
  await itemService.deleteMany(itemIdsToDelete);
};
