
import { LoggerService } from 'podverse-helpers';
import { config } from '../config';

export const loggerService = new LoggerService({
  logDir: config.log.dir,
  logLevel: config.log.level,
});