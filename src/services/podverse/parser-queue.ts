import { FeedUrl, getFeedUrl } from "podverse-orm"
import { chunkArray } from "podverse-shared"
import { awsSQSInstance } from "../../factories/aws"
import { parseFeedUrl } from "./parser"

// TODO: replace any
export const sendFeedUrlsToQueue = async (feedUrls: FeedUrl[], queueUrl: string, forceParsing: boolean, cacheBust: boolean) => {
  const attributes: any[] = []

  for (const feedUrl of feedUrls) {
    const attribute = generateFeedMessageAttributes(feedUrl, {}, forceParsing, cacheBust) as never
    attributes.push(attribute)
  }

  const entries: any[] = []
  for (const [index, key] of Array.from(attributes.entries())) {
    const entry = {
      Id: String(index),
      MessageAttributes: key,
      MessageBody: 'aws sqs requires a message body - podverse rules'
    } as never

    entries.push(entry)
  }

  const entryChunks = chunkArray(entries)
  const messagePromises = [] as any
  for (const entryChunk of entryChunks) {
    const chunkParams = {
      Entries: entryChunk,
      QueueUrl: queueUrl
    }

    messagePromises.push(awsSQSInstance.sendMessageBatch(chunkParams).promise())
  }

  Promise.all(messagePromises).catch((error) => {
    console.error('addAllFeedsToQueue: sqs.sendMessageBatch error', error)
  })
}

export const parseNextFeedFromQueue = async (queueUrl: string) => {
  const message = await awsSQSInstance.receiveMessageFromQueue(queueUrl)

  if (!message) {
    return false
  }

  const feedUrlMsg = extractFeedMessage(message)

  try {
    const feedUrl = await getFeedUrl(feedUrlMsg.id)

    if (feedUrl) {
      try {
        await parseFeedUrl(feedUrl)
      } catch (error: any) {
        console.log('error parseFeedUrl feedUrl', feedUrl.id, feedUrl.url)
        console.log('error', error)
        throw error
      }
    } else {
      try {
        await parseFeedUrl(feedUrlMsg)
      } catch (error: any) {
        console.log('error parseFeedUrl feedUrlMsg', feedUrlMsg)
        console.log('error', error)
        throw error
      }
    }
  } catch (error: any) {
    // TODO: handle error
    console.log('parseNextFeedFromQueue error', error)
  }

  await awsSQSInstance.deleteMessage(queueUrl, feedUrlMsg.receiptHandle)

  return true
}

export const parseFeedUrlsFromQueue = async (queueUrl: string, restartTimeOut: number) => {
  const shouldContinue = await parseNextFeedFromQueue(queueUrl)

  if (shouldContinue) {
    await parseFeedUrlsFromQueue(queueUrl, restartTimeOut)
  } else if (restartTimeOut) {
    setTimeout(() => {
      parseFeedUrlsFromQueue(queueUrl, restartTimeOut)
    }, restartTimeOut)
  }
}

// TODO: replace any
export const generateFeedMessageAttributes = (
  feedUrl: FeedUrl,
  error = {} as any,
  forceReparsing: boolean,
  cacheBust: boolean
) => {
  return {
    id: {
      DataType: 'String',
      StringValue: feedUrl.id
    },
    url: {
      DataType: 'String',
      StringValue: feedUrl.url
    },
    ...(feedUrl.podcast && feedUrl.podcast.id
      ? {
          podcastId: {
            DataType: 'String',
            StringValue: feedUrl.podcast && feedUrl.podcast.id
          }
        }
      : {}),
    ...(feedUrl.podcast && feedUrl.podcast.title
      ? {
          podcastTitle: {
            DataType: 'String',
            StringValue: feedUrl.podcast && feedUrl.podcast.title
          }
        }
      : {}),
    ...(forceReparsing
      ? {
          forceReparsing: {
            DataType: 'String',
            StringValue: 'TRUE'
          }
        }
      : {}),
    ...(cacheBust
      ? {
          cacheBust: {
            DataType: 'String',
            StringValue: 'TRUE'
          }
        }
      : {}),
    ...(error && error.message
      ? {
          errorMessage: {
            DataType: 'String',
            StringValue: error.message
          }
        }
      : {})
  }
}

// TODO: replace any
const extractFeedMessage = (message: any) => {
  const attrs = message.MessageAttributes
  return {
    id: attrs.id.StringValue,
    url: attrs.url.StringValue,
    ...(attrs.podcastId && attrs.podcastTitle
      ? {
          podcast: {
            id: attrs.podcastId.StringValue,
            title: attrs.podcastTitle.StringValue
          }
        }
      : {}),
    ...(attrs.forceReparsing ? { forceReparsing: true } : {}),
    ...(attrs.cacheBust ? { cacheBust: true } : {}),
    receiptHandle: message.ReceiptHandle
  } as any
}

