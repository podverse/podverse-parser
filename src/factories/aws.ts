import { AWSService } from 'podverse-external-services'
import { config } from '../config'

export const awsInstance = new AWSService({
  accessKeyId: config.aws?.accessKeyId,
  region: config.aws?.region,
  secretAccessKey: config.aws?.secretAccessKey
})
