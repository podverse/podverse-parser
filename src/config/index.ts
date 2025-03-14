export const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  shouldLogTimer: process.env.LOG_TIMER === 'true',
  userAgent: process.env.USER_AGENT || '',
  podcastIndex: {
    authKey: process.env.PODCAST_INDEX_AUTH_KEY || '',
    baseUrl: process.env.PODCAST_INDEX_BASE_URL || '',
    secretKey: process.env.PODCAST_INDEX_SECRET_KEY || ''
  }
};
