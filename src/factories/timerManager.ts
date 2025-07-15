import { TimerManager } from 'podverse-helpers/dist/lib/backend/logTimer';
import { loggerService } from './loggerService';
import { config } from '../config';

export const timerManager = new TimerManager(config.log.timer, loggerService);
