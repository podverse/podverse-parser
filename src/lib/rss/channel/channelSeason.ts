import { FeedObject } from "podcast-partytime";
import { timerManager } from "podverse-helpers";
import { Channel, ChannelSeasonService } from "podverse-orm";
import { compatChannelSeasonDtos } from "@parser/lib/compat/partytime/channel";

export const handleParsedChannelSeasons = async (parsedFeed: FeedObject, channel: Channel): Promise<void> => {
  timerManager.start('handleParsedChannelSeasons');
  const channelSeasonService = new ChannelSeasonService();
  const channelSeasonDtos = compatChannelSeasonDtos(parsedFeed);
  
  if (channelSeasonDtos.length > 0) {
    await channelSeasonService.updateMany(channel, channelSeasonDtos);
  } else {
    await channelSeasonService.deleteAll(channel);
  }
  timerManager.end('handleParsedChannelSeasons');
};
