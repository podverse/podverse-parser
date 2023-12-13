import { Episode, Podcast } from "podverse-orm"
import { getRepository, In, Not } from "typeorm"
import { ParsedEpisode } from "../partytime/compat"
import { EpisodesValueTagsByGuid } from "./valueTags"
import { checkIfVideoMediaType, isValidDate } from "podverse-shared"

export const assignParsedEpisodeData = (
  episode: Episode,
  parsedEpisode: ParsedEpisode,
  podcast: Podcast,
  pvEpisodesValueTagsByGuid: EpisodesValueTagsByGuid
) => {
  episode.isPublic = true

  episode.alternateEnclosures = parsedEpisode.alternateEnclosures
  if (parsedEpisode.ptChapters) {
    episode.chaptersUrl = parsedEpisode.ptChapters.url
    episode.chaptersType = parsedEpisode.ptChapters.type
  }
  episode.description = parsedEpisode.description
  episode.duration = parsedEpisode.duration

  /* TODO: podcast-partytime is missing type and funding on episode */
  // episode.episodeType = parsedEpisode.type
  // episode.funding = parsedEpisode.funding

  episode.guid = parsedEpisode.guid || parsedEpisode.mediaUrl
  episode.imageUrl = parsedEpisode.imageUrl
  episode.isExplicit = parsedEpisode.isExplicit

  if (typeof parsedEpisode?.itunesEpisode === 'number') {
    episode.itunesEpisode = Math.floor(parsedEpisode.itunesEpisode)
  }

  episode.itunesEpisodeType = parsedEpisode.itunesEpisodeType

  if (typeof parsedEpisode?.itunesSeason === 'number') {
    episode.itunesSeason = Math.floor(parsedEpisode.itunesSeason)
  }

  episode.linkUrl = parsedEpisode.linkUrl

  episode.mediaType = parsedEpisode.mediaType
  episode.mediaUrl = parsedEpisode.mediaUrl

  const pubDate = parsedEpisode.pubDate ? new Date(parsedEpisode.pubDate) : new Date()
  episode.pubDate = isValidDate(pubDate) ? pubDate : new Date()

  episode.socialInteraction = parsedEpisode.socialInteraction
  episode.subtitle = parsedEpisode.subtitle
  episode.title = parsedEpisode.title
  episode.transcript = parsedEpisode.transcript
  episode.value =
    parsedEpisode.value && parsedEpisode.value.length > 0
      ? parsedEpisode.value
      : pvEpisodesValueTagsByGuid && parsedEpisode.guid && pvEpisodesValueTagsByGuid[parsedEpisode.guid]?.length > 0
      ? pvEpisodesValueTagsByGuid[parsedEpisode.guid]
      : []

  episode.podcast = podcast

  return episode
}

export const findOrGenerateParsedEpisodes = async (
  parsedEpisodes: ParsedEpisode[],
  podcast: Podcast,
  pvEpisodesValueTagsByGuid: EpisodesValueTagsByGuid
) => {
  const episodeRepo = getRepository(Episode)
  const soundbitesIndex: { [key: string]: any[] } = {}

  // Parsed episodes are only valid if they have enclosure.url and guid tags,
  // so ignore all that do not.
  const validParsedEpisodes = parsedEpisodes.filter((parsedEpisode: ParsedEpisode) => {
    return parsedEpisode.mediaUrl && parsedEpisode.guid
  })

  // Create an array of only the episode guids from the parsed object
  const parsedEpisodeGuids = validParsedEpisodes.map((x) => x.guid)

  // Find episodes in the database that have matching episode media URLs AND podcast ids to
  // those found in the parsed object, then store an array of just those URLs.
  let savedEpisodes = [] as any
  if (parsedEpisodeGuids && parsedEpisodeGuids.length > 0) {
    savedEpisodes = await episodeRepo.find({
      where: {
        podcast,
        /*
          TODO: since duplicate GUIDs will exist in our system, we need to use
          isPublic: true so that previously hidden/dead episodes do not re-surface.
          If we remove all the duplicate GUID episodes in the database,
          then we could remove the isPublic: true condition. This *might* be desirable
          to handle edge cases, where episodes existed in a feed previously,
          then for some reason were removed, and then were added back into the feed.
        */
        isPublic: true,
        guid: In(parsedEpisodeGuids)
      }
    })

    /*
      If episodes exist in the database for this podcast,
      but they aren't currently in the feed, then retrieve
      and set them to isPublic = false
    */
    const episodesToHide = await episodeRepo.find({
      where: {
        podcast,
        isPublic: true,
        guid: Not(In(parsedEpisodeGuids))
      }
    })

    const updatedEpisodesToHide = episodesToHide.map((episodeToHide: Episode) => {
      episodeToHide.isPublic = false
      return episodeToHide
    })
    await episodeRepo.save(updatedEpisodesToHide, { chunk: 400 })
  }

  const savedEpisodeGuids = savedEpisodes.map((savedEpisode: Episode) => savedEpisode.guid)

  /*
    Create an array of only the parsed episodes that do not have a match
    already saved in the database.
  */
  const newParsedEpisodes = validParsedEpisodes.filter((validParsedEpisode: ParsedEpisode) =>
    !savedEpisodeGuids.includes(validParsedEpisode.guid)
  )

  const updatedSavedEpisodes: Episode[] = []
  const newEpisodes: Episode[] = []

  /* If a feed has more video episodes than audio episodes, mark it as a hasVideo podcast. */
  let videoCount = 0
  let audioCount = 0
  let hasSeasons = false

  /*
    If episode is already saved, then merge the matching episode found in
    the parsed object with what is already saved.
  */
  for (let savedEpisode of savedEpisodes) {
    const parsedEpisode = validParsedEpisodes.find((validParsedEpisode: ParsedEpisode) =>
      validParsedEpisode.guid === savedEpisode.guid
    )
    if (!parsedEpisode) continue

    savedEpisode = await assignParsedEpisodeData(savedEpisode, parsedEpisode, podcast, pvEpisodesValueTagsByGuid)

    if (savedEpisode.itunesSeason) {
      hasSeasons = true
    }

    if (savedEpisode.mediaType && checkIfVideoMediaType(savedEpisode.mediaType)) {
      videoCount++
    } else {
      audioCount++
    }

    if (!updatedSavedEpisodes.some((x: any) => x.guid === savedEpisode.guid)) {
      updatedSavedEpisodes.push(savedEpisode)
    }

    soundbitesIndex[savedEpisode.id] = parsedEpisode.ptSoundbites
  }

  /*
    If episode from the parsed object is new (not already saved),
    then create a new episode.
  */
  for (const newParsedEpisode of newParsedEpisodes) {
    let newEpisode = new Episode()
    newEpisode = await assignParsedEpisodeData(newEpisode, newParsedEpisode, podcast, pvEpisodesValueTagsByGuid)

    if (newParsedEpisode.itunesSeason) {
      hasSeasons = true
    }

    if (newParsedEpisode.mediaType && checkIfVideoMediaType(newParsedEpisode.mediaType)) {
      videoCount++
    } else {
      audioCount++
    }

    if (!newEpisodes.some((x: any) => x.guid === newEpisode.guid)) {
      newEpisodes.push(newEpisode)
    }

    soundbitesIndex[newEpisode.id] = newParsedEpisode.ptSoundbites
  }

  return {
    newEpisodes,
    updatedSavedEpisodes,
    hasSeasons,
    hasVideo: videoCount > audioCount,
    soundbitesIndex
  }
}
