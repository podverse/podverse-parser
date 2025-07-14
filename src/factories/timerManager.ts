
import { TimerManager } from 'podverse-helpers';
import { loggerService } from './loggerService';
import { config } from '../config';

export const timerManager = new TimerManager(config.log.timer, loggerService);
