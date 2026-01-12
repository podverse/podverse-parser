export const config = {
  userAgent: process.env.USER_AGENT || '',
  log: {
    level: process.env.LOG_LEVEL || 'info',
    dir: process.env.LOG_DIR || 'logs',
    timer: process.env.LOG_TIMER === 'true',
  },
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID || '',
    authJsonPath: process.env.FIREBASE_PATH_TO_AUTH_JSON || '',
  },
  podcastIndex: {
    authKey: process.env.PODCAST_INDEX_AUTH_KEY || '',
    baseUrl: process.env.PODCAST_INDEX_BASE_URL || '',
    secretKey: process.env.PODCAST_INDEX_SECRET_KEY || '',
    rateLimitDelay: parseInt(process.env.PODCAST_INDEX_API_RATE_LIMIT_DELAY || '200', 10)
  },
  parser: {
    addRemoteItemsToMQ: process.env.PARSER_ADD_REMOTE_ITEMS_TO_MQ === 'true',
  },
  defaults: {
    account: {
      settings: {
        locale: process.env.DEFAULT_ACCOUNT_SETTINGS_LOCALE || 'en-US',
      }
    }
  }
};
