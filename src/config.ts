// TODO: pass in config
export const config = {
  aws: {
    accessKeyId: '123',
    imageCloudFrontOrigin: 'some-origin',
    imageS3BucketName: 'some-bucket-name',
    region: '456',
    secretAccessKey: '789'
  },
  imageShrinker: {
    imageSize: 800
  },
  userAgent: 'Podverse/Feed Parser'
}
