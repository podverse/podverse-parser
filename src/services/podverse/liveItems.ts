import { Episode, LiveItem, Podcast, getEpisodesWithLiveItemsWithMatchingGuids, getEpisodesWithLiveItemsWithoutMatchingGuids } from "podverse-orm"
import { getRepository } from 'typeorm'
import { ParsedLiveItem } from "../partytime/compat"
import { assignParsedEpisodeData } from "./episodes"
import { EpisodesValueTagsByGuid } from "./valueTags"
import { SendNotificationOptions } from "podverse-external-services"
import { checkIfVideoMediaType } from "podverse-shared"

export const assignParsedLiveItemEpisodeData = (
  episode: Episode,
  parsedLiveItem: ParsedLiveItem,
  podcast: Podcast,
  pvEpisodesValueTagsByGuid: EpisodesValueTagsByGuid
) => {
  episode = assignParsedEpisodeData(
    episode,
    parsedLiveItem.episode,
    podcast,
    pvEpisodesValueTagsByGuid
  )

  if (parsedLiveItem.start && parsedLiveItem.status && parsedLiveItem.episode.guid) {
    const liveItem = episode.liveItem || new LiveItem()
    liveItem.end = parsedLiveItem.end || null
    liveItem.start = parsedLiveItem.start
    liveItem.status = parsedLiveItem.status
    liveItem.chatIRCURL = parsedLiveItem.chat
    episode.liveItem = liveItem

    // If a livestream has ended, set its episode to isPublic=false
    // so it doesn't get returned in requests anymore.
    if (liveItem.status === 'ended') {
      episode.isPublic = false
    }
  } else {
    episode.liveItem = null
  }

  return episode
}

export const findOrGenerateParsedLiveItems = async (
  parsedLiveItems: ParsedLiveItem[],
  podcast: Podcast,
  pvEpisodesValueTagsByGuid: EpisodesValueTagsByGuid
) => {
  const episodeRepo = getRepository(Episode)

  /*
    Parsed episodes are only valid if they have enclosure.url, liveItemStart,
    and guid tags, so ignore all that do not.
  */
  const validParsedLiveItems = parsedLiveItems.filter((parsedLiveItem: ParsedLiveItem) => {
    return parsedLiveItem.episode.mediaUrl
      && parsedLiveItem.start 
      && parsedLiveItem.episode.guid
  })

  const validParsedLiveItemGuids = validParsedLiveItems.map((parsedLiveItem: ParsedLiveItem) =>
    parsedLiveItem.episode.guid as string
  )

  /*
    Find liveItems (episodes) in the database that have matching guids AND podcast ids to
    those found in the parsed object, then store an array of just those guids.
  */
  let savedEpisodeLiveItems: Episode[] = []
  if (validParsedLiveItemGuids && validParsedLiveItemGuids.length > 0) {
    savedEpisodeLiveItems = await getEpisodesWithLiveItemsWithMatchingGuids(podcast.id, validParsedLiveItemGuids)
  }

  /*
    If liveItems exist in the database for this podcast,
    but they aren't currently in the feed, then retrieve
    and set them to isPublic = false
  */
  let episodeLiveItemsToHide = await getEpisodesWithLiveItemsWithoutMatchingGuids(podcast.id, validParsedLiveItemGuids)
  episodeLiveItemsToHide = episodeLiveItemsToHide.filter((episodeLiveItem) => episodeLiveItem.liveItem)
  const updatedLiveItemsToHide = episodeLiveItemsToHide.map((episodeLiveItemToHide: Episode) => {
    episodeLiveItemToHide.isPublic = false
    return episodeLiveItemToHide
  })
  await episodeRepo.save(updatedLiveItemsToHide, { chunk: 400 })

  const savedEpisodeLiveItemGuids = savedEpisodeLiveItems.map((episodeLiveItem: Episode) => episodeLiveItem.guid)

  /*
    Create an array of only the parsed liveItems that do not have a match
    already saved in the database.
  */
  const newParsedLiveItems = validParsedLiveItems.filter((validParsedLiveItem: ParsedLiveItem) =>
    !savedEpisodeLiveItemGuids.includes(validParsedLiveItem.episode.guid)
  )
  const updatedSavedLiveItems = [] as any
  const newEpisodeLiveItems: Episode[] = []

  /* If a feed has more video episodes than audio episodes, mark it as a hasVideo podcast. */
  let videoCount = 0
  let audioCount = 0
  let hasSeasons = false

  /*
    If episode is already saved, then merge the matching episode found in
    the parsed object with what is already saved.
    Preserve the previouslySavedLiveItems state since we will need it later
    in the shouldSendLiveNotification check.
  */
  const previouslySavedEpisodeLiveItems = JSON.parse(JSON.stringify(savedEpisodeLiveItems))
  for (let savedEpisodeLiveItem of savedEpisodeLiveItems) {
    const parsedLiveItem = validParsedLiveItems.find((validParsedLiveItem: ParsedLiveItem) =>
      validParsedLiveItem.episode.guid === savedEpisodeLiveItem.guid
    )

    if (!parsedLiveItem) continue

    savedEpisodeLiveItem = await assignParsedLiveItemEpisodeData(
      savedEpisodeLiveItem,
      parsedLiveItem,
      podcast,
      pvEpisodesValueTagsByGuid
    )

    if (parsedLiveItem.episode.itunesSeason) {
      hasSeasons = true
    }

    if (
      parsedLiveItem.episode.mediaType
      && checkIfVideoMediaType(parsedLiveItem.episode.mediaType)
    ) {
      videoCount++
    } else {
      audioCount++
    }

    if (!updatedSavedLiveItems.some((x: any) => x.guid === savedEpisodeLiveItem.guid)) {
      updatedSavedLiveItems.push(savedEpisodeLiveItem)
    }
  }

  /*
    If liveItem from the parsed object is new (not already saved),
    then create a new liveItem (episode).
  */
  for (const newParsedLiveItem of newParsedLiveItems) {
    let episode = new Episode()
    episode = await assignParsedLiveItemEpisodeData(episode, newParsedLiveItem, podcast, pvEpisodesValueTagsByGuid)

    if (newParsedLiveItem.episode.itunesSeason) {
      hasSeasons = true
    }

    if (
      newParsedLiveItem.episode.mediaType
      && checkIfVideoMediaType(newParsedLiveItem.episode.mediaType)
    ) {
      videoCount++
    } else {
      audioCount++
    }

    if (!newEpisodeLiveItems.some((x: any) => x.guid === episode.guid)) {
      newEpisodeLiveItems.push(episode)
    }
  }

  const liveItemNotificationsData: SendNotificationOptions[] = []

  for (const parsedLiveItem of parsedLiveItems) {
    const previouslySavedEpisodeLiveItem = previouslySavedEpisodeLiveItems.find(
      (previouslySavedEpisodeLiveItem: Episode) =>
      previouslySavedEpisodeLiveItem.guid === previouslySavedEpisodeLiveItem.guid
    )

    const shouldSendLiveNotification =
      parsedLiveItem.status === 'live' &&
      (!previouslySavedEpisodeLiveItem || previouslySavedEpisodeLiveItem.liveItem?.status !== 'live')

    const notificationLiveItem = previouslySavedEpisodeLiveItem
      || newEpisodeLiveItems.find((newEpisodeLiveItem: Episode) =>
          parsedLiveItem.episode.guid === newEpisodeLiveItem.guid)

    if (shouldSendLiveNotification) {
      liveItemNotificationsData.push({
        podcastId: podcast.id,
        podcastTitle: podcast.title,
        episodeTitle: parsedLiveItem.episode.title,
        podcastShrunkImageUrl: podcast.shrunkImageUrl,
        podcastFullImageUrl: podcast.imageUrl,
        episodeFullImageUrl: parsedLiveItem.episode.imageUrl,
        episodeGuid: notificationLiveItem.guid
      })
    }
  }

  return {
    newEpisodeLiveItems,
    updatedSavedLiveItems,
    hasSeasons,
    hasVideo: videoCount > audioCount,
    liveItemNotificationsData
  }
}
