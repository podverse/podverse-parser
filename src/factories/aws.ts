import { AWSS3Service, AWSSQSService } from 'podverse-external-services'
import { config } from '../config'

const awsConfig = {
  accessKeyId: config.aws?.accessKeyId,
  region: config.aws?.region,
  secretAccessKey: config.aws?.secretAccessKey
}

export const awsSQSInstance = new AWSSQSService(awsConfig)

export const awsS3Instance = new AWSS3Service(awsConfig)
