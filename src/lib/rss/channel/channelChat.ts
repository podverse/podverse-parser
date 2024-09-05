import { FeedObject } from "podcast-partytime";
import { Channel, ChannelChatService, EntityManager } from "podverse-orm";
import { compatChannelChatDto } from "@parser/lib/compat/partytime/channel";
import { handleParsedOneData } from "../base/handleParsedOneData";

export const handleParsedChannelChat = async (
  parsedFeed: FeedObject,
  channel: Channel,
  transactionalEntityManager: EntityManager
) => {
  const channelChatService = new ChannelChatService(transactionalEntityManager);
  const channelChatDto = compatChannelChatDto(parsedFeed);
  await handleParsedOneData(channel, channelChatService, channelChatDto);
};
