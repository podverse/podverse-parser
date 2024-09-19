import { FeedObject } from "podcast-partytime";
import { timerManager } from "podverse-helpers";
import { Channel, ChannelRemoteItemService, EntityManager } from "podverse-orm";
import { compatChannelRemoteItemDtos } from "@parser/lib/compat/partytime/channel";
import { handleParsedManyData } from "../base/handleParsedManyData";

export const handleParsedChannelRemoteItem = async (
  parsedFeed: FeedObject,
  channel: Channel,
  transactionalEntityManager?: EntityManager
) => {
  timerManager.start("handleParsedChannelRemoteItem");
  const channelRemoteItemService = new ChannelRemoteItemService(transactionalEntityManager);
  const channelRemoteItemDtos = compatChannelRemoteItemDtos(parsedFeed);
  await handleParsedManyData(channel, channelRemoteItemService, channelRemoteItemDtos);
  timerManager.end("handleParsedChannelRemoteItem");
};
