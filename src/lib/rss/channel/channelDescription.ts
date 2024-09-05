import { FeedObject } from "podcast-partytime";
import { Channel, ChannelDescriptionService, EntityManager } from "podverse-orm";
import { compatChannelDescriptionDto } from "@parser/lib/compat/partytime/channel";
import { handleParsedOneData } from "../base/handleParsedOneData";

export const handleParsedChannelDescription = async (
  parsedFeed: FeedObject,
  channel: Channel,
  transactionalEntityManager: EntityManager
) => {
  const channelDescriptionService = new ChannelDescriptionService(transactionalEntityManager);
  const channelDescriptionDto = compatChannelDescriptionDto(parsedFeed);
  await handleParsedOneData(channel, channelDescriptionService, channelDescriptionDto);
};
