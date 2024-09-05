import { FeedObject } from "podcast-partytime";
import { Channel, ChannelSocialInteractService, EntityManager } from "podverse-orm";
import { compatChannelSocialInteractDtos } from "@parser/lib/compat/partytime/channel";
import { handleParsedManyData } from "../base/handleParsedManyData";

export const handleParsedChannelSocialInteract = async (
  parsedFeed: FeedObject,
  channel: Channel,
  transactionalEntityManager: EntityManager
) => {
  const channelSocialInteractService = new ChannelSocialInteractService(transactionalEntityManager);
  const channelSocialInteractDtos = compatChannelSocialInteractDtos(parsedFeed);
  await handleParsedManyData(channel, channelSocialInteractService, channelSocialInteractDtos);
};
