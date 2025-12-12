import { sleep } from "podverse-helpers";
import { Channel, ChannelPodrollRemoteItemService, ChannelPodrollService, ChannelPublisherRemoteItemService, ChannelPublisherService,
  ChannelRemoteItemService, ChannelService, FeedService, ItemService } from "podverse-orm";
import { podcastIndexService } from '@parser/factories/podcastIndex';
import { parseRSSFeedAndSaveToDatabase } from '@parser/lib/rss/parser';
import { loggerService } from "@parser/factories/loggerService";

type PIFeedWithPodcastGuidData = {
  id: number;
  url: string;
}

async function handleRequestDelay(url: string) {
  const delayConfig = [
    { regex: /^https?:\/\/(www\.)?wavlake\.com/, delay: 5000 },
  ];

  for (const { regex, delay } of delayConfig) {
    if (regex.test(url)) {
      await sleep(delay);
      break;
    }
  }
}

const handleRemoteItemsFeedParsing = async (feedGuidsToParse: string[]) => {
  const piFeedDatas: PIFeedWithPodcastGuidData[] = [];
  for (const feedGuid of feedGuidsToParse) {
    const feedService = new FeedService();
    const pvExistingFeed = await feedService.getByPodcastGuid(feedGuid);

    if (!pvExistingFeed) {
      const piFeedDataResponse = await podcastIndexService.podcastGetByGuid(feedGuid);
      if (piFeedDataResponse?.feed?.id && piFeedDataResponse?.feed?.url) {
        const piFeedData: PIFeedWithPodcastGuidData = {
          id: piFeedDataResponse.feed.id,
          url: piFeedDataResponse.feed.url
        };
        piFeedDatas.push(piFeedData);
      }
    }
  }

  for (const piFeedData of piFeedDatas) {
    const feedService = new FeedService();
    let feed = await feedService.getByUrlAndPodcastIndexId({
      url: piFeedData.url,
      podcast_index_id: piFeedData.id
    });
    
    if (!feed) {
      await handleRequestDelay(piFeedData.url);
      loggerService.info(`handleRemoteItemsFeedParsing: ${piFeedData.url} ${piFeedData.id}`);
      await parseRSSFeedAndSaveToDatabase(piFeedData.url, piFeedData.id, { forceParse: false });
    }
  }
};

export const handleAllRemoteItemsFeedParsing = async (channel: Channel) => {
  const channelService = new ChannelService();
  const latestChannel = await channelService.get(channel.id);
  await handleRemoteItemsPodrollParsing(channel);
  await handleRemoteItemsPublisherParsing(channel);
  await handleRemoteItemsChannelParsing(channel);
  await handleRemoteItemsItemValueTimeSplitParsing(latestChannel);
};

const handleRemoteItemsPodrollParsing = async (channel: Channel) => {
  const channelPodrollService = new ChannelPodrollService();
  const channelPodroll = await channelPodrollService.get(channel);
  if (channelPodroll) {
    const channelPodrollRemoteItemService = new ChannelPodrollRemoteItemService();
    const channelPodrollRemoteItems = await channelPodrollRemoteItemService.getAll(channelPodroll);
    const feedGuidsToParse = channelPodrollRemoteItems.map((remoteItem) => remoteItem.feed_guid);
    await handleRemoteItemsFeedParsing(feedGuidsToParse);
  }
};

const handleRemoteItemsPublisherParsing = async (channel: Channel) => {
  const channelPublisherService = new ChannelPublisherService();
  const channelPublisher = await channelPublisherService.get(channel);
  if (channelPublisher) {
    const channelPublisherRemoteItemService = new ChannelPublisherRemoteItemService();
    const channelPublisherRemoteItems = await channelPublisherRemoteItemService.getAll(channelPublisher);
    const feedGuidsToParse = channelPublisherRemoteItems.map((remoteItem) => remoteItem.feed_guid);
    await handleRemoteItemsFeedParsing(feedGuidsToParse);
  }
};

const handleRemoteItemsChannelParsing = async (channel: Channel) => {
  const channelRemoteItemService = new ChannelRemoteItemService();
  const channelRemoteItems = await channelRemoteItemService.getAll(channel);
  const feedGuidsToParse = channelRemoteItems.map((remoteItem) => remoteItem.feed_guid);
  await handleRemoteItemsFeedParsing(feedGuidsToParse);
};

const handleRemoteItemsItemValueTimeSplitParsing = async (channel: Channel) => {
  if (channel.has_value_time_splits) {
    const itemService = new ItemService();
    const items = await itemService.getManyByChannel(channel, {
      relations: [
        'item_values',
        'item_values.item_value_time_splits',
        'item_values.item_value_time_splits.item_value_time_split_recipients',
        'item_values.item_value_time_splits.item_value_time_split_remote_item'
      ]
    });
    for (const item of items) {
      if (item) {
        if (item.item_values?.length > 0) {
          for (const itemValue of item.item_values) {
            if (itemValue.item_value_time_splits?.length > 0) {
              for (const itemValueTimeSplit of itemValue.item_value_time_splits) {
                if (itemValueTimeSplit.item_value_time_split_remote_item) {
                  const feedGuid = itemValueTimeSplit.item_value_time_split_remote_item.feed_guid;
                  await handleRemoteItemsFeedParsing([feedGuid]);
                }
              }
            }
          }
        }
      }   
    }
  }
};
