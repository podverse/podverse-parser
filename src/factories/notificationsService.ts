
import { NotificationsService } from 'podverse-external-services';
import { loggerService } from './loggerService';
import { config } from '../config';

export const NotificationsServiceFactory = (googleAuthToken: string) => new NotificationsService({
  googleAuthToken,
  firebaseProjectId: config.firebase.projectId,
  loggerService
});
