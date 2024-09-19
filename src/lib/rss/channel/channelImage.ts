import { FeedObject } from "podcast-partytime";
import { timerManager } from "podverse-helpers";
import { Channel, ChannelImageService, EntityManager } from "podverse-orm";
import { compatChannelImageDtos } from "@parser/lib/compat/partytime/channel";
import { handleParsedManyData } from "../base/handleParsedManyData";

export const handleParsedChannelImage = async (
  parsedFeed: FeedObject,
  channel: Channel,
  transactionalEntityManager?: EntityManager
) => {
  timerManager.start("handleParsedChannelImage");
  const channelImageService = new ChannelImageService(transactionalEntityManager);
  const channelImageDtos = compatChannelImageDtos(parsedFeed);
  await handleParsedManyData(channel, channelImageService, channelImageDtos);
  timerManager.end("handleParsedChannelImage");
};
