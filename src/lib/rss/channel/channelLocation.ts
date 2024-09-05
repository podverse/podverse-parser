import { FeedObject } from "podcast-partytime";
import { Channel, ChannelLocationService, EntityManager } from "podverse-orm";
import { compatChannelLocationDto } from "@parser/lib/compat/partytime/channel";
import { handleParsedOneData } from "../base/handleParsedOneData";

export const handleParsedChannelLocation = async (
  parsedFeed: FeedObject,
  channel: Channel,
  transactionalEntityManager: EntityManager
) => {
  const channelLocationService = new ChannelLocationService(transactionalEntityManager);
  const channelLocationDtos = compatChannelLocationDto(parsedFeed);
  await handleParsedOneData(channel, channelLocationService, channelLocationDtos);
};
