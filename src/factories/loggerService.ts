import { LoggerService } from 'podverse-helpers/dist/lib/backend/logger';
import { config } from '../config';

export const loggerService = new LoggerService({
  logLevel: config.log.level,
});