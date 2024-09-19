import { FeedObject } from "podcast-partytime";
import { timerManager } from "podverse-helpers";
import { Channel, ChannelTxtService, EntityManager } from "podverse-orm";
import { compatChannelTxtDtos } from "@parser/lib/compat/partytime/channel";
import { handleParsedManyData } from "../base/handleParsedManyData";

export const handleParsedChannelTxt = async (
  parsedFeed: FeedObject,
  channel: Channel,
  transactionalEntityManager?: EntityManager
) => {
  timerManager.start("handleParsedChannelTxt");
  const channelTxtService = new ChannelTxtService(transactionalEntityManager);
  const channelTxtDtos = compatChannelTxtDtos(parsedFeed);
  await handleParsedManyData(channel, channelTxtService, channelTxtDtos);
  timerManager.end("handleParsedChannelTxt");
};
