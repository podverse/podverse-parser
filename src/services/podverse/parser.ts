import { SendNotificationOptions } from 'podverse-external-services'
import {
  Episode as ORMEpisode,
  FeedUrl,
  getEpisodeByPodcastIdAndGuid,
  getFeedUrls,
  getFeedUrlsByPodcastIndexIds,
  getLiveItemByGuid,
  getPodcast,
  Podcast as ORMPodcast,
  retrieveLatestChapters,
  updateSoundBites
} from 'podverse-orm'
import {
  _logEnd,
  _logStart,
  addParameterToURL,
  convertToSortableTitle,
  generateAbortAPI,
  isValidDate,
  logPerformance
} from 'podverse-shared'
import { getRepository } from 'typeorm'
import { notificationsInstance } from '../../factories/notifications'
import { partytimeInstance } from '../../factories/partytime'
import { podcastIndexAPIInstance } from '../../factories/podcastIndex'
import { uploadImageToS3AndSaveToDatabase } from '../imageShrinker'
import { getLatestLiveItemInfo, getLatestLiveItemStatus } from '../partytime/compat'
import { handleSaveAuthors } from './authors'
import { handleSaveCategories } from './categories'
import { checkIfShouldSendNotification } from './notifications'
import { EpisodesValueTagsByGuid } from './valueTags'
import { findOrGenerateParsedEpisodes } from './episodes'
import { findOrGenerateParsedLiveItems } from './liveItems'
import { getSavedPodcastIfExists } from './podcasts'

type Constructor = {
  userAgent: string
}

export class ParserService {
  declare userAgent: string

  constructor ({ userAgent }: Constructor) {
    this.userAgent = userAgent
  }

  parseFeedUrl = async (feedUrl: FeedUrl, allowNonPublic?: boolean) => {
    logPerformance('parseFeedUrl', _logStart, 'feedUrl.url ' + feedUrl.url)
    
    const abortAPI = generateAbortAPI()

    try {
      /*
        Sometimes adding a cacheBust param will prevent RSS feeds from being parsed correctly.
        The `excludeCacheBust` column exists to manually disable cacheBust as needed.
      */
      const excludeCacheBust = feedUrl?.podcast?.excludeCacheBust
      const urlToParse = !excludeCacheBust ? addParameterToURL(feedUrl.url, `cacheBust=${Date.now()}`) : feedUrl.url
      logPerformance('*** urlToParse', urlToParse)

      const parsedFeed = await partytimeInstance.parseFeed(urlToParse, abortAPI)
      clearTimeout(abortAPI.abortTimeout)

      const {
        podcast: parsedPodcast,
        episodes: parsedEpisodes,
        liveItems: parsedLiveItems
      } = parsedFeed

      const podcast = await getSavedPodcastIfExists(feedUrl, allowNonPublic)
      logPerformance('podcast id', podcast.id)

      const hasLiveItem = podcast.hasLiveItem || parsedLiveItems.length > 0
      const latestLiveItemStatus = getLatestLiveItemStatus(parsedLiveItems)
      const { liveItemLatestPubDate } = getLatestLiveItemInfo(parsedLiveItems)

      const shouldSendNewEpisodeNotification = checkIfShouldSendNotification(
        parsedPodcast,
        podcast
      )

      podcast.authors = await handleSaveAuthors(parsedPodcast)
      podcast.categories = await handleSaveCategories(parsedPodcast)

      podcast.description = parsedPodcast.description
      podcast.feedLastParseFailed = false

      const feedLastUpdated = parsedPodcast.feedLastUpdated
        ? new Date(parsedPodcast.feedLastUpdated)
        : new Date()
      podcast.feedLastUpdated = isValidDate(feedLastUpdated) ? feedLastUpdated : new Date()

      podcast.funding = parsedPodcast.funding

      // guid is deprecated
      podcast.guid = parsedPodcast.podcastGuid
      // podcastGuid is the column we want to use going forward
      podcast.podcastGuid = parsedPodcast.podcastGuid

      const hasNewImageUrl = parsedPodcast.imageUrl && podcast.imageUrl !== parsedPodcast.imageUrl
      podcast.imageUrl = parsedPodcast.imageUrl

      podcast.isExplicit = parsedPodcast.isExplicit
      podcast.isPublic = true
      podcast.itunesFeedType = parsedPodcast.itunesFeedType
      podcast.language = parsedPodcast.language

      /*
        Generate the episode data to be saved later,
        and also set podcast fields based on the most recent episode's data.
      */
      let newEpisodes: ORMEpisode[] = []
      let updatedSavedEpisodes: ORMEpisode[] = []
      let newLiveItems: ORMEpisode[] = []
      let updatedSavedLiveItems: ORMEpisode[] = []
      let latestEpisodeImageUrl = ''
      let latestEpisodeGuid = ''
      let liveItemNotificationsData: SendNotificationOptions[] = []
      let soundbitesIndex: { [key: string]: any[] } = {}

      if (
        (parsedEpisodes && Array.isArray(parsedEpisodes) && parsedEpisodes.length > 0) ||
        (parsedLiveItems && Array.isArray(parsedLiveItems) && parsedLiveItems.length > 0)
      ) {

        let pvEpisodesValueTagsByGuid: EpisodesValueTagsByGuid = {}
        if (podcast.hasPodcastIndexValueTag && podcast.podcastIndexId) {
          try {
            pvEpisodesValueTagsByGuid = await podcastIndexAPIInstance.getAllEpisodeValueTagsFromPodcastIndexById(podcast.podcastIndexId)
          } catch (error: any) {
            logPerformance('pvEpisodesValueTagsByGuid error', error)
          }
        }

        const episodesResults = await findOrGenerateParsedEpisodes(
          parsedEpisodes,
          podcast,
          pvEpisodesValueTagsByGuid
        )

        const liveItemsResults = await findOrGenerateParsedLiveItems(
          parsedLiveItems,
          podcast,
          pvEpisodesValueTagsByGuid
        )

        podcast.hasLiveItem = hasLiveItem
        podcast.hasSeasons = episodesResults.hasSeasons || liveItemsResults.hasSeasons
        podcast.hasVideo = episodesResults.hasVideo || liveItemsResults.hasVideo

        newEpisodes = episodesResults.newEpisodes
        updatedSavedEpisodes = episodesResults.updatedSavedEpisodes
        newEpisodes = newEpisodes && newEpisodes.length > 0 ? newEpisodes : []
        updatedSavedEpisodes = updatedSavedEpisodes && updatedSavedEpisodes.length > 0 ? updatedSavedEpisodes : []

        newLiveItems = liveItemsResults.newEpisodeLiveItems
        updatedSavedLiveItems = liveItemsResults.updatedSavedLiveItems
        newLiveItems = newLiveItems && newLiveItems.length > 0 ? newLiveItems : []
        updatedSavedLiveItems = updatedSavedLiveItems && updatedSavedLiveItems.length > 0 ? updatedSavedLiveItems : []

        liveItemNotificationsData = liveItemsResults.liveItemNotificationsData

        const latestNewEpisode = newEpisodes.reduce((r: any, a: any) => {
          return r.pubDate > a.pubDate ? r : a
        }, [])

        const latestUpdatedSavedEpisode = updatedSavedEpisodes.reduce((r: any, a: any) => {
          return r.pubDate > a.pubDate ? r : a
        }, [])

        const latestEpisode =
          (!Array.isArray(latestNewEpisode) && latestNewEpisode) ||
          ((!Array.isArray(latestUpdatedSavedEpisode) && latestUpdatedSavedEpisode) as any)

        const lastEpisodePubDate =
          liveItemLatestPubDate && new Date(liveItemLatestPubDate) > new Date(latestEpisode.pubDate)
            ? new Date(liveItemLatestPubDate)
            : new Date(latestEpisode.pubDate)

        podcast.lastEpisodePubDate = isValidDate(lastEpisodePubDate) ? lastEpisodePubDate : undefined
        podcast.lastEpisodeTitle = latestEpisode.title
        latestEpisodeGuid = latestEpisode.guid
        latestEpisodeImageUrl = latestEpisode.imageUrl || ''

        soundbitesIndex = episodesResults.soundbitesIndex
      } else {
        podcast.lastEpisodePubDate = undefined
        podcast.lastEpisodeTitle = ''
      }

      podcast.latestLiveItemStatus = latestLiveItemStatus
      podcast.linkUrl = parsedPodcast.linkUrl
      podcast.medium = parsedPodcast.medium
      podcast.sortableTitle = parsedPodcast.title ? convertToSortableTitle(parsedPodcast.title) : ''
      podcast.subtitle = parsedPodcast.subtitle
      podcast.title = parsedPodcast.title
      podcast.type = parsedPodcast.type
      podcast.value = parsedPodcast.value

      if ((!podcast.value || podcast.value.length === 0) && podcast.hasPodcastIndexValueTag && podcast.podcastIndexId) {
        try {
          podcast.value = await podcastIndexAPIInstance.getPodcastValueTagForPodcastIndexId(podcast.podcastIndexId)
        } catch (error: any) {
          logPerformance(`getPodcastValueTagForPodcastIndexId error ${error}`)
        }
      }

      const podcastRepo = getRepository(ORMPodcast)
      await podcastRepo.save(podcast)

      if (hasNewImageUrl) {
        await uploadImageToS3AndSaveToDatabase(podcast, podcastRepo)
      }

      const episodeRepo = getRepository(ORMEpisode)
      await episodeRepo.save(updatedSavedEpisodes, { chunk: 400 })
      await episodeRepo.save(newEpisodes, { chunk: 400 })
      await episodeRepo.save(updatedSavedLiveItems, { chunk: 400 })
      await episodeRepo.save(newLiveItems, { chunk: 400 })

      const feedUrlRepo = getRepository(FeedUrl)
      const cleanedFeedUrl = {
        id: feedUrl.id,
        url: feedUrl.url,
        podcast
      }

      await feedUrlRepo.update(feedUrl.id, cleanedFeedUrl)

      // Retrieve the episode to make sure we have the episode.id
      const latestEpisodeWithId = await getEpisodeByPodcastIdAndGuid(podcast.id, latestEpisodeGuid)

      if (shouldSendNewEpisodeNotification) {
        const podcastShrunkImageUrl = podcast.shrunkImageUrl
        const podcastFullImageUrl = podcast.imageUrl
        const episodeFullImageUrl = latestEpisodeImageUrl

        if (latestEpisodeWithId?.id) {
          await notificationsInstance.sendNewEpisodeDetectedNotification({
            podcastId: podcast.id,
            podcastTitle: podcast.title,
            episodeTitle: podcast.lastEpisodeTitle,
            podcastShrunkImageUrl,
            podcastFullImageUrl,
            episodeFullImageUrl,
            episodeId: latestEpisodeWithId.id
          })
        }
      }

      if (liveItemNotificationsData && liveItemNotificationsData.length > 0) {
        for (const liveItemNotificationData of liveItemNotificationsData) {
          if (liveItemNotificationData.episodeGuid) {
            // Retrieve the live item - episode to make sure we have the episode.id
            const liveItemWithId = await getLiveItemByGuid(liveItemNotificationData.episodeGuid, podcast.id)
            const { podcastShrunkImageUrl, podcastFullImageUrl, episodeFullImageUrl }
              = liveItemNotificationData
    
            if (liveItemWithId?.episode?.id) {
              await notificationsInstance.sendLiveItemLiveDetectedNotification({
                podcastId: liveItemNotificationData.podcastId,
                podcastTitle: liveItemNotificationData.podcastTitle,
                episodeTitle: liveItemNotificationData.episodeTitle,
                podcastShrunkImageUrl,
                podcastFullImageUrl,
                episodeFullImageUrl,
                episodeId: liveItemWithId?.episode?.id
              })
            } else {
              logPerformance('not found: liveItemWithId not found', liveItemNotificationData.episodeGuid, podcast.id)
            }
          }
        }
      }

      for (const updatedSavedEpisode of updatedSavedEpisodes) {
        const soundBiteArray = soundbitesIndex[updatedSavedEpisode.id]
        if (Array.isArray(soundBiteArray) && soundBiteArray.length > 0) {
          await updateSoundBites(
            updatedSavedEpisode.id,
            soundBiteArray,
            updatedSavedEpisode.title,
            podcast.title
          )
        }
      }

      for (const newEpisode of newEpisodes) {
        const soundBiteArray = soundbitesIndex[newEpisode.id]
        if (Array.isArray(soundBiteArray) && soundBiteArray.length > 0) {
          await updateSoundBites(newEpisode.id, soundBiteArray, newEpisode.title, podcast.title)
        }
      }

      /*
        Run retrieveLatestChapters only for the latest episode to make sure
        chapters are pre-populated in our database. Otherwise the first person
        who plays the episode will not see chapters.
      */
      if (latestEpisodeWithId?.id) await retrieveLatestChapters(latestEpisodeWithId.id)
    } catch (error: any) {
      throw error
    } finally {
      clearTimeout(abortAPI.abortTimeout)
    }

    logPerformance('parseFeedUrl', _logEnd, 'feedUrl.url ' + feedUrl.url)
  }

  parseFeedUrlsByPodcastIds = async (podcastIds: string[]) => {
    const feedUrls = await getFeedUrls({
      podcastId: podcastIds,
      isAuthority: true
    })

    for (const feedUrl of feedUrls) {
      try {
        await this.parseFeedUrl(feedUrl)
      } catch (error: any) {
        await this.handlePodcastFeedLastParseFailed(feedUrl, error)
      }
    }

    logPerformance('parseFeedUrlsByPodcastIds finished')
    return
  }

  parseFeedUrlsByPodcastIndexIds = async (podcastIndexIds: string[]) => {
    const feedUrls = await getFeedUrlsByPodcastIndexIds(podcastIndexIds)

    for (const feedUrl of feedUrls) {
      try {
        await this.parseFeedUrl(feedUrl)
      } catch (error: any) {
        await this.handlePodcastFeedLastParseFailed(feedUrl, error)
      }
    }

    logPerformance('getFeedUrlsByPodcastIndexIds finished')
    return
  }

  handlePodcastFeedLastParseFailed = async (feedUrlMsg: any, inheritedError: Error) => {
    console.log('\n\n\n')
    console.log('***** PODCAST PARSING FAILED *****')
    console.log('podcast.title ', feedUrlMsg && feedUrlMsg.podcast && feedUrlMsg.podcast.title)
    console.log('podcast.id    ', feedUrlMsg && feedUrlMsg.podcast && feedUrlMsg.podcast.id)
    console.log('feedUrl.id    ', feedUrlMsg && feedUrlMsg.id)
    console.log('feedUrl.url   ', feedUrlMsg && feedUrlMsg.url)
    console.log(inheritedError && inheritedError.message)
    console.log('\n\n\n')

    if (feedUrlMsg && feedUrlMsg.podcast && feedUrlMsg.podcast.id) {
      try {
        const savedPodcast = await getPodcast(feedUrlMsg.podcast.id, false)
        savedPodcast.feedLastParseFailed = true
        const podcastRepo = getRepository(ORMPodcast)
        await podcastRepo.save(savedPodcast)
      } catch (err) {
        logPerformance(`setPodcastFeedLastParseFailed ${feedUrlMsg.podcast.id} ${err}`)
      }
    }
  }

}
