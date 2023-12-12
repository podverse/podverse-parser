import { NotificationsService } from 'podverse-external-services'
import { config } from '../config'

export const notificationsInstance = new NotificationsService({
  googleAuthToken: config.google.authToken,
  userAgent: config.userAgent
})
