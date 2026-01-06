import { AccountFCMDevicePlatformEnum, AccountNotificationTypeEnum } from 'podverse-helpers';
import {
  AccountFCMDeviceService,
  AccountNotificationChannelService,
  AccountNotificationChannelType,
  Channel,
  ChannelImage,
  ChannelService,
  Item
} from 'podverse-orm';
import { NotificationMessageType, notificationOrchestrator, NotificationPlatform } from 'podverse-external-services';
import { loggerService } from '@parser/factories/loggerService';

export type DeviceWithLocale = {
  fcm_token: string;
  platform: NotificationPlatform;
  locale: string;
  account_id: number;
};

export type ItemNotificationData = {
  itemTitle: string;
  channelTitle: string;
  imageUrl: string | null;
  itemIdText: string;
  channelIdText: string;
  messageType: NotificationMessageType;
};

// Minimum acceptable image size for notifications (in pixels)
const NOTIFICATION_IMAGE_MIN_SIZE = 200;
// Ideal image size for notifications - not too large to waste bandwidth
const NOTIFICATION_IMAGE_IDEAL_SIZE = 512;

/**
 * Selects the best image from a list based on notification requirements.
 * Prefers images above minimum size, closest to ideal size.
 * Falls back to largest available if none meet minimum.
 */
export function selectBestImage<T extends { url: string; image_width_size?: number | null }>(
  images: T[]
): string | null {
  if (!images || images.length === 0) {
    return null;
  }

  // Filter images that meet the minimum size requirement
  const adequateImages = images.filter(
    img => (img.image_width_size || 0) >= NOTIFICATION_IMAGE_MIN_SIZE
  );

  if (adequateImages.length > 0) {
    // From adequate images, find the one closest to ideal size
    // Prefer slightly larger over slightly smaller
    const sortedByIdeal = [...adequateImages].sort((a, b) => {
      const diffA = Math.abs((a.image_width_size || 0) - NOTIFICATION_IMAGE_IDEAL_SIZE);
      const diffB = Math.abs((b.image_width_size || 0) - NOTIFICATION_IMAGE_IDEAL_SIZE);
      if (diffA === diffB) {
        // If equal distance from ideal, prefer the larger one
        return (b.image_width_size || 0) - (a.image_width_size || 0);
      }
      return diffA - diffB;
    });
    return sortedByIdeal[0].url;
  }

  // No images meet minimum size - fall back to largest available
  const sortedBySize = [...images].sort((a, b) => 
    (b.image_width_size || 0) - (a.image_width_size || 0)
  );
  return sortedBySize[0].url;
}

/**
 * Gets the best available image URL from item images or channel images
 */
export function getBestImageUrl(item: Item, channelImages: ChannelImage[]): string | null {
  // Try item images first
  if (item.item_images && item.item_images.length > 0) {
    const itemImageUrl = selectBestImage(item.item_images);
    if (itemImageUrl) {
      return itemImageUrl;
    }
  }

  // Fall back to channel images
  if (channelImages && channelImages.length > 0) {
    return selectBestImage(channelImages);
  }

  return null;
}

/**
 * Converts AccountFCMDevicePlatformEnum to NotificationPlatform
 */
export function convertPlatform(platform: AccountFCMDevicePlatformEnum): NotificationPlatform {
  switch (platform) {
  case AccountFCMDevicePlatformEnum.Web:
    return 'web';
  case AccountFCMDevicePlatformEnum.Android:
    return 'android';
  case AccountFCMDevicePlatformEnum.iOS:
    return 'ios';
  case AccountFCMDevicePlatformEnum.Generic:
  default:
    return 'generic';
  }
}

/**
 * Groups devices by locale and platform for batch notification sending
 */
export function groupDevicesByLocaleAndPlatform(devices: DeviceWithLocale[]): Map<string, Map<NotificationPlatform, string[]>> {
  const localeMap = new Map<string, Map<NotificationPlatform, string[]>>();

  for (const device of devices) {
    if (!localeMap.has(device.locale)) {
      localeMap.set(device.locale, new Map());
    }
    const platformMap = localeMap.get(device.locale)!;
    
    if (!platformMap.has(device.platform)) {
      platformMap.set(device.platform, []);
    }
    platformMap.get(device.platform)!.push(device.fcm_token);
  }

  return localeMap;
}

/**
 * Loads channel images if not already present on the channel object
 */
export async function loadChannelImages(channel: Channel): Promise<ChannelImage[]> {
  if (channel.channel_images) {
    return channel.channel_images;
  }
  
  const channelService = new ChannelService();
  const channelWithImages = await channelService.getByIdText(channel.id_text, {
    channel_images: true
  });
  return channelWithImages?.channel_images || [];
}

/**
 * Gets devices for accounts that have a specific notification type enabled for a channel
 */
export async function getDevicesForNotificationType(
  channelIdText: string,
  notificationType: AccountNotificationTypeEnum
): Promise<{ devices: DeviceWithLocale[]; accountLocaleMap: Map<number, string> } | null> {
  // Get all account notification channels for this channel with their types
  const accountNotificationChannelService = new AccountNotificationChannelService();
  const notificationChannels = await accountNotificationChannelService.getAllByChannelIdText(
    channelIdText,
    {
      relations: {
        account_notification_channel_types: true,
        account: {
          account_settings: {
            account_settings_locale: true
          }
        }
      }
    }
  );

  // Filter to only accounts that have the specified notification type enabled
  const accountIdsWithTypeEnabled: number[] = [];
  const accountLocaleMap = new Map<number, string>();

  for (const notificationChannel of notificationChannels) {
    const hasType = notificationChannel.account_notification_channel_types?.some(
      (type: AccountNotificationChannelType) => type.type === notificationType
    );

    if (hasType) {
      accountIdsWithTypeEnabled.push(notificationChannel.account_id);
      
      // Store the locale for each account
      const locale = notificationChannel.account?.account_settings?.account_settings_locale?.locale || 'en-US';
      accountLocaleMap.set(notificationChannel.account_id, locale);
    }
  }

  // Early return if no accounts have this notification type enabled
  if (accountIdsWithTypeEnabled.length === 0) {
    return null;
  }

  // Get all FCM devices for the filtered account IDs in a single batch query
  const accountFCMDeviceService = new AccountFCMDeviceService();
  const deviceResults = await accountFCMDeviceService.getAllForAccountIds(accountIdsWithTypeEnabled);

  // Early return if no devices to send to
  if (deviceResults.length === 0) {
    return null;
  }

  // Map devices to DeviceWithLocale format
  const devices: DeviceWithLocale[] = deviceResults.map(device => ({
    fcm_token: device.fcm_token,
    platform: convertPlatform(device.platform),
    locale: device.locale || accountLocaleMap.get(device.account_id) || 'en-US',
    account_id: device.account_id
  }));

  return { devices, accountLocaleMap };
}

/**
 * Sends notifications for items to grouped devices
 */
export async function sendItemNotifications(
  itemNotifications: ItemNotificationData[],
  groupedDevices: Map<string, Map<NotificationPlatform, string[]>>
): Promise<void> {
  for (const itemNotification of itemNotifications) {
    const messageText = `${itemNotification.channelTitle} - ${itemNotification.itemTitle}`;

    for (const [locale, platformMap] of groupedDevices) {
      for (const [platform, tokens] of platformMap) {
        try {
          await notificationOrchestrator({
            service: 'firebase',
            tokens,
            messageText,
            messageType: itemNotification.messageType,
            locale,
            platform,
            icon: itemNotification.imageUrl || undefined,
            linkIdText: itemNotification.itemIdText,
            data: {
              itemIdText: itemNotification.itemIdText,
              channelIdText: itemNotification.channelIdText,
              type: itemNotification.messageType
            }
          });

          loggerService.info(
            `Sent ${itemNotification.messageType} notification to ${tokens.length} ${platform} devices (${locale}) for item: ${itemNotification.itemIdText}`
          );
        } catch (error) {
          loggerService.logError(
            `Failed to send notification for item ${itemNotification.itemIdText} to ${platform} devices (${locale})`,
            error as Error
          );
        }
      }
    }
  }
}
