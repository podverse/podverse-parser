import nodeFetch from 'node-fetch'
import { parseFeed } from 'podcast-partytime'
import { ParsedEpisode, ParsedLiveItem, ParsedPodcast, episodeCompat, podcastAndLiveItemCompat } from './compat'

type AbortAPI = {
  abortController: AbortController
  abortTimeout: NodeJS.Timeout
}

type Constructor = {
  userAgent: string
}

type ParsedFeedResponse = {
  podcast: ParsedPodcast
  episodes: ParsedEpisode[]
  liveItems: ParsedLiveItem[]
}

export class PartytimeService  {
  declare userAgent: string

  constructor ({ userAgent }: Constructor) {
    this.userAgent = userAgent
  }
  
  parseFeed = async (url: string, abortAPI: AbortAPI): Promise<ParsedFeedResponse> => {
    try {
      const { abortController } = abortAPI
      const response = await nodeFetch(url, {
        headers: { 'User-Agent': this.userAgent },
        follow: 5,
        size: 40000000,
        signal: abortController.signal
      })
  
      if (response.ok) {
        const xml = await response.text()
        const parsedFeed = parseFeed(xml, { allowMissingGuid: true })
        
        if (!parsedFeed) {
          throw new Error('parseFeedUrl invalid partytime parser response')
        }
  
        const { podcast, liveItems } = podcastAndLiveItemCompat(parsedFeed)
        const episodes = parsedFeed.items.map(episodeCompat)
  
        return { podcast, episodes, liveItems }
      } else {
        const errorBody = await response.text()
        throw new Error(errorBody)
      }    
    } catch (error: any) {
      throw new Error(error)
    }
  }
}
