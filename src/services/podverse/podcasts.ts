import { FeedUrl, Podcast, getPodcast } from "podverse-orm"

export const getSavedPodcastIfExists = async (feedUrl: FeedUrl, allowNonPublic?: boolean) => {
  let podcast = new Podcast()
  if (feedUrl.podcast) {
    const savedPodcast = await getPodcast(feedUrl.podcast.id, false, allowNonPublic)
    if (!savedPodcast) throw Error('Invalid podcast id provided.')
    podcast = savedPodcast
  }
  return podcast
}
