import { NotificationsService, SendNotificationOptions } from "podverse-external-services/dist/services/notifications";
import { findImageBySize } from "podverse-helpers";
import { AccountFCMDeviceService, Channel, Item, ItemService } from "podverse-orm";
import { HandleParsedItemsResult } from "../rss/item/item";
import { HandleParsedLiveItemsResult } from "../rss/liveItem/liveItem";

export const handleNotifications = async (
  items: Item[],
  accountFCMDeviceService: AccountFCMDeviceService,
  sendNotificationMethod: (fcmTokens: string[], options: SendNotificationOptions) => Promise<void>
) => {
  for (const item of items) {
    const channel = item.channel;
    const fcmTokens = await accountFCMDeviceService.getFCMTokensByChannelIdText(channel.id_text);

    const channelImage = findImageBySize(channel.channel_images, 300, 'lesser');
    const itemImage = findImageBySize(item.item_images, 300, 'lesser');

    const sendNotificationOptions: SendNotificationOptions = {
      itemFullImageUrl: itemImage?.url || null,
      itemGuid: item.guid,
      itemIdText: item.id_text,
      itemTitle: item.title,
      channelIdText: item.channel.channel_id_text,
      channelFullImageUrl: channelImage?.url || null,
      channelTitle: item.channel.title
    };
    await sendNotificationMethod(fcmTokens, sendNotificationOptions);
  }
};

export const handleNewItemsNotifications = async (
  newItemIdentifiers: HandleParsedItemsResult,
  channel: Channel,
  notificationsService: NotificationsService,
  accountFCMDeviceService: AccountFCMDeviceService,
  itemService: ItemService
) => {
  const itemsByGuid = await itemService.getManyByGuid(
    channel,
    newItemIdentifiers.newItemGuids,
    {
      relations: ['channel', 'channel.channel_images', 'item_images']
    }
  );

  const itemsByGuidEnclosureUrl = await itemService.getManyByGuidEnclosureUrl(channel, newItemIdentifiers.newItemGuids);
  const itemsToNotify = itemsByGuid.concat(itemsByGuidEnclosureUrl);

  await handleNotifications(
    itemsToNotify,
    accountFCMDeviceService,
    notificationsService.sendNewItemDetectedNotifications
  );
};

export const handleNewLiveItemsNotifications = async (
  newLiveItemIdentifiers: HandleParsedLiveItemsResult,
  channel: Channel,
  notificationsService: NotificationsService,
  accountFCMDeviceService: AccountFCMDeviceService,
  itemService: ItemService
) => {
  
  const itemsByGuid = await itemService.getManyByGuid(
    channel,
    newLiveItemIdentifiers.newItemGuids,
    {
      relations: ['channel', 'channel.channel_images', 'item_images']
    }
  );

  await handleNotifications(
    itemsByGuid,
    accountFCMDeviceService,
    notificationsService.sendLiveItemLiveDetectedNotifications
  );
};