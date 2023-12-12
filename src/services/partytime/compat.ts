import { Episode as PartytimeEpisode, FeedObject, Phase1Funding, Phase4Medium, Phase4Value } from "podcast-partytime"
import { Phase4PodcastLiveItem } from 'podcast-partytime/dist/parser/phase/phase-4'
import { PhasePendingChat } from 'podcast-partytime/dist/parser/phase/phase-pending'
import {
  Episode,
  Funding,
  LiveItemStatus,
  Podcast,
  podcastItunesTypeDefaultValue,
  ValueTagOriginal
} from "podverse-shared"

/*
  The compat functions convert the podcast-partytime schema
  into the podverse schema, but without the properties that are
  only relevant for podcast's saved in our database.
*/

export interface ParsedPodcast extends Pick<
  Podcast,
  'podcastGuid'
  | 'description'
  | 'funding'
  | 'imageUrl'
  | 'isExplicit'
  | 'itunesFeedType'
  | 'language'
  | 'linkUrl'
  | 'medium'
  | 'subtitle'
  | 'title'
  | 'type'
  | 'value'
> {
  ptAuthors: string[]
  ptCategories?: string[]
}

export interface ParsedEpisode extends Pick<
  Episode,
  'guid'
  | 'alternateEnclosures'
  | 'chaptersUrl'
  // | 'contentLinks' TODO:
  | 'description'
  | 'duration'
  // | 'funding' TODO:
  | 'imageUrl'
  | 'isExplicit'
  | 'itunesEpisode'
  | 'itunesEpisodeType'
  | 'itunesSeason'
  | 'linkUrl'
  | 'mediaType'
  | 'mediaUrl'
  | 'pubDate'
  | 'socialInteraction'
  | 'subtitle'
  | 'title'
  | 'transcript'
  | 'value'
> {
  // TODO: why any[] instead of Transcript[]?
  transcript: any[]
  ptAuthors: any[]
  ptChapters?: any
  ptSoundbites: any[]
}

export type ParsedLiveItem = {
  chat?: string
  episode: ParsedEpisode
  end?: Date | null
  start?: Date
  status?: LiveItemStatus
}

type ParsedPodcastAndLiveItems = {
  podcast: ParsedPodcast
  liveItems: ParsedLiveItem[]
}

// TODO: why are these "extended" interfaces necessary?
interface ExtendedPartytimeLiveItem extends Phase4PodcastLiveItem {
  chat?: PhasePendingChat
  image?: string
}

interface ExtendedChat extends Omit<PhasePendingChat, 'phase'> {
  phase?: 'pending' | '4'
  protocol: string
  url?: string
}

export const podcastAndLiveItemCompat = (feed: FeedObject): ParsedPodcastAndLiveItems => {
  return {
    podcast: {
      podcastGuid: feed.guid,
      description: feed.description,
      funding: Array.isArray(feed.podcastFunding) ? feed.podcastFunding?.map((f) => fundingCompat(f)) : [],
      imageUrl: feed.itunesImage || feed.image?.url,
      isExplicit: feed.explicit,
      itunesFeedType: feed.itunesType || podcastItunesTypeDefaultValue,
      language: feed.language,
      linkUrl: feed.link,
      medium: feed.medium ?? Phase4Medium.Podcast,
      subtitle: feed.subtitle,
      title: feed.title,
      type: feed.itunesType,
      value: feed.value ? [valueCompat(feed.value)] : [],
      ptAuthors: Array.isArray(feed.author) ? feed.author : feed.author ? [feed.author] : [],
      ptCategories: feed.itunesCategory,
    },
    liveItems: feed?.podcastLiveItems?.map((x: any) => liveItemCompatToEpisode(x)) ?? []
  }
}

export const episodeCompat = (episode: PartytimeEpisode): ParsedEpisode => {
  return {
    guid: episode.guid,
    alternateEnclosures: episode.alternativeEnclosures ?? [],
    // TODO: why does contentLinks exist on liveItem but not episode type?
    // contentLinks: episode.contentLinks || [],
    description: getLongerSummary(episode.content, episode.description),
    duration: episode.duration,
    // TODO: episode.podcastFunding does not exist in partytime
    // funding: Array.isArray(episode.podcastFunding) ? episode.podcastFunding?.map((f) => fundingCompat(f)) : [],
    imageUrl: episode.image,
    isExplicit: episode.explicit,
    itunesEpisode: episode.podcastEpisode?.number || episode.itunesEpisode,
    itunesEpisodeType: episode.itunesEpisodeType,
    itunesSeason: episode.podcastSeason?.number || episode.itunesSeason,
    linkUrl: episode.link,
    mediaType: episode.enclosure.type,
    mediaUrl: episode.enclosure.url,
    pubDate: episode.pubDate,
    socialInteraction: episode.podcastSocialInteraction ?? [],
    subtitle: episode.subtitle,
    title: episode.title,
    transcript: episode.podcastTranscripts ?? [],
    value: episode.value ? [valueCompat(episode.value)] : [],
    ptAuthors: [episode.author],
    ptChapters: episode.podcastChapters,
    ptSoundbites: episode.podcastSoundbites ?? []
  }
}

export const liveItemCompatToEpisode = (liveItem: ExtendedPartytimeLiveItem): ParsedLiveItem => {
  const getChatEmbedUrlValue = (chat?: ExtendedChat) => {
    if (chat?.phase === 'pending' && chat.embedUrl) {
      return chat.embedUrl
    }
    // deprecated embed value
    else if (chat?.phase === '4' && chat.url) {
      return chat.url
    }
    return ''
  }

  return {
    chat: getChatEmbedUrlValue(liveItem.chat),
    end: liveItem.end,
    episode: episodeCompat({
      ...liveItem,
      // TODO: why is contentLinks broken?
      // contentLinks: liveItem.contentLinks,
      duration: 0,
      explicit: false,
      // socialInteraction: []
    }),
    start: liveItem.start,
    // TODO: does partytime already convert toLowerCase?
    status: liveItem.status?.toLowerCase() as LiveItemStatus
  }
}

const fundingCompat = (funding: Phase1Funding): Funding => {
  return {
    value: funding.message,
    url: funding.url
  }
}

const valueCompat = (val: Phase4Value): ValueTagOriginal => {
  return {
    type: val.type,
    method: val.method,
    suggested: val.suggested,
    recipients: val.recipients.map((r) => {
      return {
        name: r.name,
        type: r.type,
        address: r.address,
        split: r.split.toString(),
        fee: r.fee,
        customKey: r.customKey,
        customValue: r.customValue
      }
    }),
    // TODO: get rid of / resolve valueTimeSplits type issue?
    valueTimeSplits: val.valueTimeSplits as any || []
  }
}

// Whichever summary is longer we are assuming is the "full summary" and
// assigning to the summary column.
const getLongerSummary = (content?: string, description?: string) => {
  const contentLength = content ? content.length : 0
  const descriptionLength = description ? description.length : 0
  const longerSummary = contentLength >= descriptionLength ? content : description
  return longerSummary
}

export const getLatestLiveItemStatus = (parsedLiveItems: ParsedLiveItem[]) => {
  let latestLiveItemStatus = 'none' as LiveItemStatus
  for (const parsedLiveItem of parsedLiveItems) {
    const liveItemStatus = parsedLiveItem.status?.toLowerCase()
    if (liveItemStatus === 'live') {
      latestLiveItemStatus = 'live'
      break
    } else if (
      liveItemStatus === 'pending'
      && latestLiveItemStatus !== 'live'
    ) {
      latestLiveItemStatus = 'pending'
    } else if (
      liveItemStatus === 'ended'
      && latestLiveItemStatus !== 'live'
      && latestLiveItemStatus !== 'pending'
    ) {
      latestLiveItemStatus = 'ended'
    }
  }
  return latestLiveItemStatus
}

export const getLatestLiveItemInfo = (parsedLiveItems: ParsedLiveItem[]) => {
  let liveItemLatestPubDate = null
  let liveItemLatestTitle = ''
  let liveItemLatestImageUrl = ''
  for (const parsedLiveItem of parsedLiveItems) {
    const liveItemStatus = parsedLiveItem.status?.toLowerCase()
    if (
      liveItemStatus === 'live'
      && (
        !liveItemLatestPubDate
        || new Date(parsedLiveItem.start as any) > new Date(liveItemLatestPubDate)
      )
    ) {
      liveItemLatestPubDate = parsedLiveItem.start
      liveItemLatestTitle = parsedLiveItem.episode.title || 'Untitled Livestream'
      liveItemLatestImageUrl = parsedLiveItem.episode.imageUrl || ''
    }
  }
  return { liveItemLatestImageUrl, liveItemLatestPubDate, liveItemLatestTitle }
}
