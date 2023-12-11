import request from 'axios'
import { convertToSlug } from 'podverse-shared'
import { s3 } from './aws'
import { config } from '../config'
import sharp from 'sharp'

const { awsConfig, shrunkImageSize } = config
const { imageCloudFrontOrigin, imageS3BucketName } = awsConfig

// This handles requesting the original image from the podcaster's server,
// shrinking the image, then PUTing it on our S3 bucket.
export const shrinkImage = async (podcast: any) => {
  try {
    const imgResponse = await request({
      method: 'GET',
      responseEncoding: 'binary',
      responseType: 'arraybuffer',
      timeout: 15000,
      url: podcast.imageUrl
    })

    const shrunkImage = await sharp(imgResponse.data).resize(shrunkImageSize).toFormat('jpg').toBuffer()

    let slug = podcast.title ? convertToSlug(podcast.title) : 'image'
    slug = `${slug}-${Date.now()}`
    const filePath = `podcast-images/${podcast.id}/`
    const fileName = `${slug}.jpg`

    const s3Params = {
      Bucket: imageS3BucketName,
      Key: filePath + fileName,
      Body: shrunkImage,
      ContentType: 'image/jpeg'
    }

    const result = await s3.upload(s3Params).promise()

    return imageCloudFrontOrigin + '/' + result.Key
  } catch (error: any) {
    console.log('Image saving failed')
    console.log('title', podcast.title)
    console.log('imageUrl', podcast.imageUrl)
    console.log(error.message)
    return null
  }
}