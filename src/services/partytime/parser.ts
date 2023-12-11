import nodeFetch from 'node-fetch'
import { parseFeed } from 'podcast-partytime'
import { episodeCompat, liveItemCompatToEpisode, podcastCompat } from './compat'

type AbortAPI = {
  abortController: AbortController
  abortTimeout: NodeJS.Timeout
}

type Constructor = {
  userAgent: string
}

export class PartytimeService  {
  declare userAgent: string

  constructor ({ userAgent }: Constructor) {
    this.userAgent = userAgent
  }
  
  parseFeed = async (url: string, abortAPI: AbortAPI) => {
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
  
        const podcast = podcastCompat(parsedFeed)
        const episodes = parsedFeed.items.map(episodeCompat)
        const liveItems = podcast.liveItems.map((x: any) => liveItemCompatToEpisode(x))
  
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
