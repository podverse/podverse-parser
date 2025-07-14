import { FirebaseAccessTokenService } from 'podverse-external-services';
import { config } from '../config';

export const firebaseAccessTokenService = new FirebaseAccessTokenService({
  keyFilePath: config.firebase.authJsonPath
});
