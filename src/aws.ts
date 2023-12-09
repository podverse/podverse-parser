import aws from 'aws-sdk'
import { config } from './config'

const { awsConfig } = config
const awsRegion = awsConfig.region

aws.config.update({
  region: awsRegion,
  httpOptions: {
    connectTimeout: 5000,
    timeout: 5000
  }
})

export const sqs = new aws.SQS()
export const s3 = new aws.S3()
