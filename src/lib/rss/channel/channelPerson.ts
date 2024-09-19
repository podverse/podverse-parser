import { FeedObject } from "podcast-partytime";
import { timerManager } from "podverse-helpers";
import { Channel, ChannelPersonService, EntityManager } from "podverse-orm";
import { compatChannelPersonDtos } from "@parser/lib/compat/partytime/channel";
import { handleParsedManyData } from "../base/handleParsedManyData";

export const handleParsedChannelPerson = async (
  parsedFeed: FeedObject,
  channel: Channel,
  transactionalEntityManager?: EntityManager
) => {
  timerManager.start("handleParsedChannelPerson");
  const channelPersonService = new ChannelPersonService(transactionalEntityManager);
  const channelPersonDtos = compatChannelPersonDtos(parsedFeed);
  await handleParsedManyData(channel, channelPersonService, channelPersonDtos);
  timerManager.end("handleParsedChannelPerson");
};
