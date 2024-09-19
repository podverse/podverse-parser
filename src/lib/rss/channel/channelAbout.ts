import { FeedObject } from "podcast-partytime";
import { timerManager } from "podverse-helpers";
import { ChannelAboutService, Channel, EntityManager } from "podverse-orm";
import { compatChannelAboutDto } from "@parser/lib/compat/partytime/channel";

export const handleParsedChannelAbout = async (
  parsedFeed: FeedObject,
  channel: Channel,
  transactionalEntityManager?: EntityManager
) => {
  timerManager.start("handleParsedChannelAbout");
  const channelAboutService = new ChannelAboutService(transactionalEntityManager);
  const channelAboutDto = compatChannelAboutDto(parsedFeed);
  await channelAboutService.update(channel, channelAboutDto);
  timerManager.end("handleParsedChannelAbout");
};
