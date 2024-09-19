import { FeedObject } from "podcast-partytime";
import { timerManager } from "podverse-helpers";
import { Channel, ChannelDescriptionService, EntityManager } from "podverse-orm";
import { compatChannelDescriptionDto } from "@parser/lib/compat/partytime/channel";
import { handleParsedOneData } from "../base/handleParsedOneData";

export const handleParsedChannelDescription = async (
  parsedFeed: FeedObject,
  channel: Channel,
  transactionalEntityManager?: EntityManager
) => {
  timerManager.start("handleParsedChannelDescription");
  const channelDescriptionService = new ChannelDescriptionService(transactionalEntityManager);
  const channelDescriptionDto = compatChannelDescriptionDto(parsedFeed);
  await handleParsedOneData(channel, channelDescriptionService, channelDescriptionDto);
  timerManager.end("handleParsedChannelDescription");
};
