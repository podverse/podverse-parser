import request from 'axios'
import { Podcast, convertToSlug } from 'podverse-shared'
import { config } from '../config'
import { awsInstance } from '../factories/aws'
import sharp from 'sharp'

// This handles requesting the original image from the podcaster's server,
// shrinking the image, then PUTing it on our S3 bucket.
export const shrinkImage = async (podcast: Podcast) => {
  try {

    if (!podcast?.imageUrl) {
      console.log('shrinkImage: no podcast.imageUrl found')
      return
    }

    const imgResponse = await request({
      method: 'GET',
      responseEncoding: 'binary',
      responseType: 'arraybuffer',
      timeout: 15000,
      url: podcast.imageUrl
    })

    const shrunkImage = await sharp(imgResponse.data)
      .resize(config.imageShrinker?.imageSize)
      .toFormat('jpg')
      .toBuffer()

    let slug = podcast.title ? convertToSlug(podcast.title) : 'image'
    slug = `${slug}-${Date.now()}`
    const filePath = `podcast-images/${podcast.id}/`
    const fileName = `${slug}.jpg`

    const s3Params = {
      Bucket: config.aws?.imageS3BucketName,
      Key: filePath + fileName,
      Body: shrunkImage,
      ContentType: 'image/jpeg'
    }

    const result = await awsInstance.s3.upload(s3Params).promise()

    return config.aws?.imageCloudFrontOrigin + '/' + result.Key
  } catch (error: any) {
    console.log('Image saving failed')
    console.log('title', podcast.title)
    console.log('imageUrl', podcast.imageUrl)
    console.log(error.message)
    return null
  }
}
