import { Episode, FeedObject, Phase1Funding, Phase4Medium, Phase4Value } from "podcast-partytime"
import { Phase4PodcastLiveItem } from 'podcast-partytime/dist/parser/phase/phase-4'
import { PhasePendingChat } from 'podcast-partytime/dist/parser/phase/phase-pending'
import { Funding, ParsedEpisode, ParsedLiveItem, ValueTagOriginal, podcastItunesTypeDefaultValue } from "podverse-shared"

/*
  The compat functions convert the podcast-partytime schema
  to the podverse schema.
*/

// TODO: can we get rid of these interfaces?
interface ExtendedEpisode extends Episode {
  contentLinks?: any
  socialInteraction?: any
}

interface ExtendedPhase4PodcastLiveItem extends Phase4PodcastLiveItem {
  chat?: PhasePendingChat
  image?: string
}

interface ExtendedChat extends Omit<PhasePendingChat, 'phase'> {
  phase?: 'pending' | '4'
  protocol: string
  url?: string
}

export const fundingCompat = (funding: Phase1Funding): Funding => {
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

export const podcastCompat = (feed: FeedObject) => {
  return {
    author: Array.isArray(feed.author) ? feed.author : feed.author ? [feed.author] : [],
    blocked: feed.itunesBlock,
    categories: feed.itunesCategory,
    description: feed.description,
    explicit: feed.explicit,
    funding: Array.isArray(feed.podcastFunding) ? feed.podcastFunding?.map((f) => fundingCompat(f)) : [],
    generator: feed.generator,
    guid: feed.guid,
    imageURL: feed.itunesImage || feed.image?.url,
    itunesType: feed.itunesType || podcastItunesTypeDefaultValue,
    language: feed.language,
    lastBuildDate: feed.lastBuildDate,
    link: feed.link,
    liveItems: feed.podcastLiveItems ?? [] as ParsedEpisode[],
    medium: feed.medium ?? Phase4Medium.Podcast,
    owner: feed.owner,
    pubDate: feed.pubDate,
    subtitle: feed.subtitle,
    summary: feed.summary,
    title: feed.title,
    type: feed.itunesType,
    value: feed.value ? [valueCompat(feed.value)] : []
  }
}

// Convert the podcast-partytime schema to a podverse compatible schema.
export const episodeCompat = (episode: ExtendedEpisode) => {
  return {
    alternateEnclosures: episode.alternativeEnclosures ?? [],
    author: [episode.author],
    chapters: episode.podcastChapters,
    // TODO: why does contentLinks exist on liveItem but not episode type?
    contentLinks: episode.contentLinks || [],
    description: episode.content || episode.description,
    duration: episode.duration,
    enclosure: episode.enclosure,
    explicit: episode.explicit,
    // funding: Array.isArray(episode.podcastFunding) ? episode.podcastFunding?.map((f) => fundingCompat(f)) : [],
    guid: episode.guid,
    imageURL: episode.image,
    itunesEpisode: episode.podcastEpisode?.number || episode.itunesEpisode,
    itunesEpisodeType: episode.itunesEpisodeType,
    itunesSeason: episode.podcastSeason?.number || episode.itunesSeason,
    link: episode.link,
    pubDate: episode.pubDate,
    socialInteraction: episode.podcastSocialInteraction ?? [],
    soundbite: episode.podcastSoundbites ?? [],
    subtitle: episode.subtitle,
    summary: getLongerSummary(episode.content, episode.description),
    title: episode.title,
    transcript: episode.podcastTranscripts ?? [],
    value: episode.value ? [valueCompat(episode.value)] : []
  } as ParsedEpisode
}

export const liveItemCompatToEpisode = (liveItem: ExtendedPhase4PodcastLiveItem) => {
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
      contentLinks: liveItem.contentLinks, // TODO:
      duration: 0,
      explicit: false, // TODO: liveItem.explicit
      socialInteraction: [],
      subtitle: '', // TODO: liveItem.subtitle
      summary: '', // TODO: liveItem.summary
    }),
    start: liveItem.start,
    status: liveItem.status?.toLowerCase()
  } as ParsedLiveItem
}

// Whichever summary is longer we are assuming is the "full summary" and
// assigning to the summary column.
const getLongerSummary = (content?: string, description?: string) => {
  const contentLength = content ? content.length : 0
  const descriptionLength = description ? description.length : 0
  const longerSummary = contentLength >= descriptionLength ? content : description
  return longerSummary
}
