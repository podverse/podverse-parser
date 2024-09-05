import { FeedObject } from "podcast-partytime";
import { Channel, ChannelImageService, EntityManager } from "podverse-orm";
import { compatChannelImageDtos } from "@parser/lib/compat/partytime/channel";
import { handleParsedManyData } from "../base/handleParsedManyData";

export const handleParsedChannelImage = async (
  parsedFeed: FeedObject,
  channel: Channel,
  transactionalEntityManager: EntityManager
) => {
  const channelImageService = new ChannelImageService(transactionalEntityManager);
  const channelImageDtos = compatChannelImageDtos(parsedFeed);
  await handleParsedManyData(channel, channelImageService, channelImageDtos);
};
