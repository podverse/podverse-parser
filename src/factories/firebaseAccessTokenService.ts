import { FirebaseAccessTokenService } from 'podverse-external-services';
import { config } from '../config';

export const firebaseAccessTokenServiceFactory = () => new FirebaseAccessTokenService({
  keyFilePath: config.firebase.authJsonPath
});
