# Factory Function: createParserContext

## Overview

The `createParserContext` function is the factory function for creating a parser context. This function sets up services for parsing RSS feeds, including Podcast Index service, logger, timer manager, and integrates with notifications and Firebase contexts.

**Important**: This factory function requires `createORMContext()` to be called first, as the parser uses ORM services internally.

## Function Signature

```typescript
export function createParserContext(params: CreateParserContextParams): ParserContext
```

## Parameters

### `params: CreateParserContextParams` (Required)

The parser configuration parameters object with the following structure:

#### `config: ParserConfig` (Required)

Parser configuration object:

##### `userAgent: string` (Required)
- User-Agent string for external API requests
- Format: `BrandName Bot Environment/AppName/Version`
- Example: `Podverse Bot Local/Parser/5`

##### `log: LogConfig` (Required)
- **`level: string`** (Required) - Log level (e.g., `'info'`, `'debug'`, `'error'`)
- **`dir?: string`** (Optional) - Log directory path
- **`timer?: boolean`** (Optional) - Enable log timers

##### `firebase: FirebaseConfig` (Required)
- **`notifications_enabled: boolean`** (Required) - Whether Firebase notifications are enabled
- **`authJsonPath?: string`** (Optional) - Path to Firebase admin JSON key file
  - Required if `notifications_enabled` is `true`

##### `podcastIndex: PodcastIndexConfig` (Required)
- **`authKey: string`** (Required) - Podcast Index API authentication key
- **`baseUrl: string`** (Required) - Podcast Index API base URL
- **`secretKey: string`** (Required) - Podcast Index API secret key
- **`rateLimitDelay?: number`** (Optional) - Rate limit delay in milliseconds for API requests

##### `parser: ParserSettingsConfig` (Required)
- **`addRemoteItemsToMQ: boolean`** (Required) - Whether to add remote items to message queue

##### `defaults: DefaultsConfig` (Required)
- **`account.settings.locale: string`** (Required) - Default locale for account settings
  - Must be a valid locale from supported locales

#### `notificationsContext: NotificationsContext` (Required)

Notifications context from `podverse-notifications` module. This must be created by calling `createNotificationsContext()` from `podverse-notifications` first.

#### `firebaseContext: FirebaseContext` (Required)

Firebase context from `podverse-external-services` module. This must be created by calling `createFirebaseContext()` from `podverse-external-services` first.

## Return Type

### `ParserContext`

Returns an object with the following properties:

- **`config: ParserConfig`** - The configuration object that was passed in
- **`loggerService: ILoggerLike`** - Logger service instance
- **`podcastIndexService: PodcastIndexService`** - Podcast Index service instance
- **`timerManager: TimerManager`** - Timer manager instance
- **`notificationsContext: NotificationsContext`** - Notifications context (passed through)
- **`firebaseContext: FirebaseContext`** - Firebase context (passed through)

## Dependencies

### Required Factory Functions (Must be called first)

1. **`createORMContext()` from `podverse-orm`**
   - The parser uses ORM services internally, so the ORM context must be created and initialized first

2. **`createNotificationsContext()` from `podverse-notifications`**
   - The notifications context must be created and passed to this factory

3. **`createFirebaseContext()` from `podverse-external-services`**
   - The Firebase context must be created and passed to this factory

## Important Notes

### Module-Level Context

This function sets the module-level context via `setParserContext()`, which allows services within the parser module to access the context without needing to pass it explicitly.

### Service Initialization

The factory creates and initializes the following services:
- `LoggerService` - Configured with log level from config
- `PodcastIndexService` - Configured with user agent, auth keys, and logger
- `TimerManager` - Configured with timer setting from config

### ORM Dependency

**CRITICAL**: The parser module uses ORM services internally. You must call `createORMContext()` and initialize the DataSources before calling this factory function.

## Example Usage

```typescript
import { createORMContext } from 'podverse-orm';
import { createFirebaseContext } from 'podverse-external-services';
import { createNotificationsContext } from 'podverse-notifications';
import { createParserContext } from 'podverse-parser';

// 1. Create ORM context first (required)
const ormConfig = { /* ... */ };
const ormContext = createORMContext(ormConfig);
await ormContext.dataSourceRead.initialize();
await ormContext.dataSourceReadWrite.initialize();

// 2. Create Firebase context
const externalServicesConfig = { /* ... */ };
const firebaseContext = createFirebaseContext(externalServicesConfig);

// 3. Create Notifications context
const notificationsConfig = { /* ... */ };
const notificationsContext = createNotificationsContext(notificationsConfig);

// 4. Create Parser context
const parserConfig = {
  userAgent: process.env.USER_AGENT!,
  log: {
    level: process.env.LOG_LEVEL || 'info',
    dir: process.env.LOG_DIR,
    timer: process.env.LOG_TIMER === 'true',
  },
  firebase: {
    notifications_enabled: process.env.GOOGLE_FIREBASE_NOTIFICATIONS_ENABLED === 'true',
    authJsonPath: process.env.GOOGLE_FIREBASE_ADMIN_JSON_KEY_PATH,
  },
  podcastIndex: {
    authKey: process.env.PODCAST_INDEX_AUTH_KEY!,
    baseUrl: process.env.PODCAST_INDEX_BASE_URL!,
    secretKey: process.env.PODCAST_INDEX_SECRET_KEY!,
    rateLimitDelay: process.env.PODCAST_INDEX_API_RATE_LIMIT_DELAY 
      ? parseInt(process.env.PODCAST_INDEX_API_RATE_LIMIT_DELAY, 10) 
      : undefined,
  },
  parser: {
    addRemoteItemsToMQ: process.env.PARSER_ADD_REMOTE_ITEMS_TO_MQ === 'true',
  },
  defaults: {
    account: {
      settings: {
        locale: process.env.DEFAULT_ACCOUNT_SETTINGS_LOCALE!,
      }
    }
  }
};

const parserContext = createParserContext({
  config: parserConfig,
  notificationsContext,
  firebaseContext,
});

// Now you can use the parser services
```

## Related Files

- **Factory implementation**: `src/factory.ts`
- **Configuration types**: `src/config/types.ts`
- **Context management**: `src/context.ts`
