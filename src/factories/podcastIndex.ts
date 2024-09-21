import { PodcastIndexService } from 'podverse-external-services';
import { config } from '@parser/config';

const authKey = config.podcastIndex.authKey || '';
const baseUrl = config.podcastIndex.baseUrl || '';
const secretKey = config.podcastIndex.secretKey || '';

export const podcastIndexService = new PodcastIndexService({ authKey, baseUrl, secretKey });
