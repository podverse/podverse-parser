import { FeedObject, Phase4Medium } from "podcast-partytime";
import { DATABASE_CONSTANTS } from "podverse-helpers";
import { Phase4PodcastImage } from "podcast-partytime/dist/parser/phase/phase-4";
import { createSortableTitle, getBooleanOrNull } from "podverse-helpers";
import { getChannelItunesTypeItunesTypeEnumValue, getMediumEnumValue } from "podverse-orm";
import { compatChannelValue } from "@parser/lib/compat/partytime/value";

export const compatChannelDto = (parsedFeed: FeedObject) => ({
  podcast_guid: parsedFeed.guid?.slice(0, DATABASE_CONSTANTS.varchar_guid) || null,
  title: parsedFeed.title?.slice(0, DATABASE_CONSTANTS.varchar_normal) || null,
  sortable_title: createSortableTitle(parsedFeed.title)?.slice(0, DATABASE_CONSTANTS.varchar_short) || null,
  medium: getMediumEnumValue(parsedFeed.medium ?? Phase4Medium.Podcast)
});

export const compatChannelAboutDto = (parsedFeed: FeedObject) => ({
  author: (
    (Array.isArray(parsedFeed.author)
      ? parsedFeed.author
      : parsedFeed.author 
        ? [parsedFeed.author] : []
    )?.join(', '))?.slice(0, DATABASE_CONSTANTS.varchar_normal) || null,
  explicit: getBooleanOrNull(parsedFeed.explicit),
  language: parsedFeed.language?.slice(0, DATABASE_CONSTANTS.varchar_short) || null,
  website_link_url: parsedFeed.link?.slice(0, DATABASE_CONSTANTS.varchar_url) || null,
  itunes_type: getChannelItunesTypeItunesTypeEnumValue(parsedFeed.itunesType || 'episodic'),
  episode_count: parsedFeed.items?.length || 0,
  last_pub_date: parsedFeed.items?.reduce((latest, item) => {
    if (item.pubDate) {
      const itemDate = new Date(item.pubDate);
      return itemDate > latest ? itemDate : latest;
    }
    return latest;
  }, new Date(0)) || null
});

export const compatChannelChatDto = (parsedFeed: FeedObject) => {
  if (!parsedFeed.chat) {
    return null;
  }
  return {
    server: parsedFeed.chat.server?.slice(0, DATABASE_CONSTANTS.varchar_fqdn) || null,
    protocol: parsedFeed.chat.protocol.slice(0, DATABASE_CONSTANTS.varchar_short),
    account_id: parsedFeed.chat.accountId?.slice(0, DATABASE_CONSTANTS.varchar_normal) || null,
    space: parsedFeed.chat.space?.slice(0, DATABASE_CONSTANTS.varchar_normal) || null
  };
};

export const compatChannelDescriptionDto = (parsedFeed: FeedObject) => {
  if (!parsedFeed.description) {
    return null;
  }
  return {
    value: parsedFeed.description.slice(0, DATABASE_CONSTANTS.varchar_long)
  };
};

export const compatChannelFundingDtos = (parsedFeed: FeedObject) => {
  const dtos = [];

  if (Array.isArray(parsedFeed.podcastFunding)) {
    for (const f of parsedFeed.podcastFunding) {
      if (f.url) {
        dtos.push({
          url: f.url?.slice(0, DATABASE_CONSTANTS.varchar_url),
          title: f.message?.slice(0, DATABASE_CONSTANTS.varchar_normal) || null
        });
      }
    }
  }

  return dtos;
};

export const compatChannelImageDtos = (parsedFeed: FeedObject) => {
  const dtos = [];
  if (parsedFeed.itunesImage) {
    dtos.push({
      url: parsedFeed.itunesImage.slice(0, DATABASE_CONSTANTS.varchar_url),
      image_width_size: null
    });
  } else if (parsedFeed.image?.url) {
    dtos.push({
      url: parsedFeed.image.url.slice(0, DATABASE_CONSTANTS.varchar_url),
      image_width_size: null
    });
  }

  function hasWidth(image: Phase4PodcastImage['parsed']): image is { url: string; width: number } {
    return (image as { width: number }).width !== undefined;
  }

  if (Array.isArray(parsedFeed.podcastImages)) {
    for (const image of parsedFeed.podcastImages) {
      if (image.parsed.url && hasWidth(image.parsed)) {
        dtos.push({
          url: image.parsed.url.slice(0, DATABASE_CONSTANTS.varchar_url),
          image_width_size: image.parsed.width
        });
      }
    }
  }

  return dtos;
};

export const compatChannelLicenseDto = (parsedFeed: FeedObject) => {
  if (!parsedFeed?.license?.identifier) {
    return null;
  }
  return {
    identifier: parsedFeed.license.identifier.slice(0, DATABASE_CONSTANTS.varchar_normal),
    url: parsedFeed.license.url?.slice(0, DATABASE_CONSTANTS.varchar_url) || null
  };
};

export const compatChannelLocationDto = (parsedFeed: FeedObject) => {
  if (!parsedFeed?.podcastLocation?.geo && !parsedFeed?.podcastLocation?.osm) {
    return null;
  }

  return {
    geo: parsedFeed.podcastLocation.geo?.slice(0, DATABASE_CONSTANTS.varchar_normal) || null,
    osm: parsedFeed.podcastLocation.osm?.slice(0, DATABASE_CONSTANTS.varchar_normal) || null,
    name: parsedFeed.podcastLocation.name?.slice(0, DATABASE_CONSTANTS.varchar_normal) || null
  };
};

export const compatChannelPersonDtos = (parsedFeed: FeedObject) => {
  const dtos = [];

  if (Array.isArray(parsedFeed.podcastPeople)) {
    for (const p of parsedFeed.podcastPeople) {
      if (p.name) {
        dtos.push({
          name: p.name.slice(0, DATABASE_CONSTANTS.varchar_normal),
          role: p.role?.toLowerCase()?.slice(0, DATABASE_CONSTANTS.varchar_normal) || null,
          person_group: p.group?.toLowerCase()?.slice(0, DATABASE_CONSTANTS.varchar_normal) || 'cast',
          img: p.img?.slice(0, DATABASE_CONSTANTS.varchar_url) || null,
          href: p.href?.slice(0, DATABASE_CONSTANTS.varchar_url) || null
        });
      }
    }
  }

  return dtos;
};

export const compatChannelPodrollRemoteItemDtos = (parsedFeed: FeedObject) => {
  const dtos = [];

  if (Array.isArray(parsedFeed.podroll)) {
    for (const ri of parsedFeed.podroll) {
      if (ri.feedGuid) {
        dtos.push({
          feed_guid: ri.feedGuid.slice(0, DATABASE_CONSTANTS.varchar_guid),
          feed_url: ri.feedUrl?.slice(0, DATABASE_CONSTANTS.varchar_url) || null,
          item_guid: null,
          title: /* PTDO: ri.title || */ null
        });
      }
    }
  }

  return dtos;
};

export const compatChannelPublisherRemoteItemDtos = (parsedFeed: FeedObject) => {
  const dtos = [];

  if (Array.isArray(parsedFeed.podroll)) {
    for (const ri of parsedFeed.podroll) {
      if (ri.feedGuid) {
        dtos.push({
          feed_guid: ri.feedGuid.slice(0, DATABASE_CONSTANTS.varchar_guid),
          feed_url: ri.feedUrl?.slice(0, DATABASE_CONSTANTS.varchar_url) || null,
          item_guid: null,
          title: /* PTDO: ri.title || */ null
        });
      }
    }
  }

  return dtos;
};

export const compatChannelRemoteItemDtos = (parsedFeed: FeedObject) => {
  const dtos = [];

  if (Array.isArray(parsedFeed.podcastRemoteItems)) {
    for (const ri of parsedFeed.podcastRemoteItems) {
      if (ri.feedGuid) {
        dtos.push({
          feed_guid: ri.feedGuid.slice(0, DATABASE_CONSTANTS.varchar_guid),
          feed_url: ri.feedUrl?.slice(0, DATABASE_CONSTANTS.varchar_url) || null,
          item_guid: null,
          title: /* PTDO: ri.title || */ null
        });
      }
    }
  }

  return dtos;
};

export const compatChannelSocialInteractDtos = (parsedFeed: FeedObject) => {
  const dtos = [];

  if (parsedFeed?.podcastSocial?.length) {
    for (const ps of parsedFeed.podcastSocial) {
      dtos.push({
        // PTDO: fix keys mismatch between partytime and podverse
        protocol: ps.platform.slice(0, DATABASE_CONSTANTS.varchar_short),
        uri: ps.url.slice(0, DATABASE_CONSTANTS.varchar_uri),
        account_id: ps.id?.slice(0, DATABASE_CONSTANTS.varchar_normal) || null,
        account_url: ps.name?.slice(0, DATABASE_CONSTANTS.varchar_url) || null,
        priority: ps.priority || null
      });
    }
  }

  return dtos;
};

export const compatChannelSeasonDtos = (parsedFeed: FeedObject) => {
  const dtos = [];

  const parsedItems = parsedFeed?.items || [];

  const seasonsIndex: { [key: number]: { name: string | null } } = {};

  for (const parsedItem of parsedItems) {
    const seasonNumber = parsedItem?.podcastSeason?.number || parsedItem?.itunesSeason;
    const seasonName = parsedItem?.podcastSeason?.name || null;
    if (Number.isInteger(seasonNumber)) {
      const seasonNumberAsNumber = seasonNumber as number;
      seasonsIndex[seasonNumberAsNumber] = {
        name: seasonName?.slice(0, DATABASE_CONSTANTS.varchar_normal) || null
      };
    }
  }

  for (const [number, { name }] of Object.entries(seasonsIndex)) {
    dtos.push({
      number: parseInt(number),
      name: name || null
    });
  }

  return dtos;
};

export const compatChannelTrailerDtos = (parsedFeed: FeedObject) => {
  const dtos = [];
  if (parsedFeed?.trailers?.length) {
    for (const pt of parsedFeed.trailers) {
      dtos.push({
        url: pt.url.slice(0, DATABASE_CONSTANTS.varchar_url),
        title: /* PTDO: add pt.title || */ null,
        pubdate: pt.pubdate,
        length: pt.length || null,
        type: pt.type?.slice(0, DATABASE_CONSTANTS.varchar_short) || null,
        season: pt.season || null
      });
    }
  }

  return dtos;
};

export const compatChannelTxtDtos = (parsedFeed: FeedObject) => {
  const dtos = [];
  if (parsedFeed?.podcastTxt?.length) {
    for (const pt of parsedFeed.podcastTxt) {
      dtos.push({
        purpose: pt.purpose?.slice(0, DATABASE_CONSTANTS.varchar_normal) || null,
        value: pt.value.slice(0, DATABASE_CONSTANTS.varchar_long)
      });
    }
  }

  return dtos;
};

export const compatChannelValueDtos = (parsedFeed: FeedObject) => {
  let dtos = [];
  if (parsedFeed.value) {
    const dto = compatChannelValue(parsedFeed.value);

    const formattedDto = {
      channel_value: {
        type: dto.type.slice(0, DATABASE_CONSTANTS.varchar_short),
        method: dto.method.slice(0, DATABASE_CONSTANTS.varchar_short),
        suggested: dto.suggested || null
      },
      channel_value_recipients: dto.channel_value_recipients
    };

    dtos.push(formattedDto);
  }
  return dtos;
};
