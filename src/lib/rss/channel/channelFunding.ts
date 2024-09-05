import { FeedObject } from "podcast-partytime";
import { Channel, ChannelFundingService, EntityManager } from "podverse-orm";
import { compatChannelFundingDtos } from "@parser/lib/compat/partytime/channel";
import { handleParsedManyData } from "../base/handleParsedManyData";

export const handleParsedChannelFunding = async (
  parsedFeed: FeedObject,
  channel: Channel,
  transactionalEntityManager: EntityManager
) => {
  const channelFundingService = new ChannelFundingService(transactionalEntityManager);
  const channelFundingDtos = compatChannelFundingDtos(parsedFeed);
  await handleParsedManyData(channel, channelFundingService, channelFundingDtos);
};
