import { FeedObject } from "podcast-partytime";
import { timerManager } from "podverse-helpers";
import { Channel, ChannelLicenseService, EntityManager } from "podverse-orm";
import { compatChannelLicenseDto } from "@parser/lib/compat/partytime/channel";
import { handleParsedOneData } from "../base/handleParsedOneData";

export const handleParsedChannelLicense = async (
  parsedFeed: FeedObject,
  channel: Channel,
  transactionalEntityManager?: EntityManager
) => {
  timerManager.start("handleParsedChannelLicense");
  const channelLicenseService = new ChannelLicenseService(transactionalEntityManager);
  const channelLicenseDtos = compatChannelLicenseDto(parsedFeed);
  await handleParsedOneData(channel, channelLicenseService, channelLicenseDtos);
  timerManager.end("handleParsedChannelLicense");
};
