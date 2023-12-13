import { Podcast } from 'podverse-orm'
import { ParsedPodcast } from "../partytime/compat"

export const checkIfShouldSendNotification = (
  parsedPodcast: ParsedPodcast,
  podcast: Podcast
): boolean => {
  const mostRecentEpisodePubDate = parsedPodcast.newestItemPubDate
  const previousLastEpisodePubDate = podcast.lastEpisodePubDate
  return (
    !previousLastEpisodePubDate && !!mostRecentEpisodePubDate)
    || (!!previousLastEpisodePubDate && !!mostRecentEpisodePubDate &&
    new Date(previousLastEpisodePubDate) < new Date(mostRecentEpisodePubDate)
  )
}
