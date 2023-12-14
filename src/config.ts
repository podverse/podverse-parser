import { parseIntOrDefault } from "podverse-shared"

export const config = {
  aws: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    imageCloudFrontOrigin: process.env.AWS_IMAGE_CLOUDFRONT_ORIGIN || '',
    imageS3BucketName: process.env.AWS_IMAGE_S3_BUCKET_NAME || '',
    region: process.env.AWS_REGION || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ''
  },
  google: {
    authToken: process.env.GOOGLE_AUTH_TOKEN || ''
  },
  imageShrinker: {
    imageSize: parseIntOrDefault(process.env.IMAGE_SHRINKER_IMAGE_SIZE, 800)
  },
  podcastIndex: {
    authKey: process.env.PODCAST_INDEX_AUTH_KEY || '',
    baseUrl: process.env.PODCAST_INDEX_BASE_URL || 'https://api.podcastindex.org/api/1.0',
    secretKey: process.env.PODCAST_INDEX_SECRET_KEY || ''
  },
  userAgent: process.env.USER_AGENT || ''
}
