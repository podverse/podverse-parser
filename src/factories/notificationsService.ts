
import { NotificationsService } from 'podverse-external-services';
import { loggerService } from './loggerService';
import { config } from '../config';

export const NotificationsServiceFactory = (googleAuthToken: string) => new NotificationsService({
  userAgent: config.userAgent,
  googleAuthToken,
  firebaseProjectId: config.firebase.projectId,
  loggerService
});
