import { FeedObject } from "podcast-partytime";
import { Channel, ChannelPodrollService, ChannelPodrollRemoteItemService, EntityManager } from "podverse-orm";
import { compatChannelPodrollRemoteItemDtos } from "@parser/lib/compat/partytime/channel";

export const handleParsedChannelPodroll = async (
  parsedFeed: FeedObject,
  channel: Channel,
  transactionalEntityManager: EntityManager
) => {
  const channelPodrollService = new ChannelPodrollService(transactionalEntityManager);
  const channelPodrollDto = {};
  const channelPodrollRemoteItemService = new ChannelPodrollRemoteItemService(transactionalEntityManager);
  const channelPodrollRemoteItemDtos = compatChannelPodrollRemoteItemDtos(parsedFeed);
  
  if (channelPodrollRemoteItemDtos.length > 0) {
    const channel_podroll = await channelPodrollService.update(channel, channelPodrollDto);
    await channelPodrollRemoteItemService.updateMany(channel_podroll, channelPodrollRemoteItemDtos);
  } else {
    await channelPodrollService.delete(channel);
  }
};
