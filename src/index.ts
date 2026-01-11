/**
 * @delmare/payload-better-auth
 *
 * Better Auth adapter and plugins for Payload CMS.
 * Enables seamless integration between Better Auth and Payload.
 *
 * @packageDocumentation
 */

// Adapter
export { payloadAdapter } from './adapter/index.js'
export type { PayloadAdapterConfig } from './adapter/index.js'

// Collection generator plugin
export { betterAuthCollections } from './adapter/collections.js'
export type { BetterAuthCollectionsOptions } from './adapter/collections.js'

// Payload plugin and strategy
export {
  createBetterAuthPlugin,
  betterAuthStrategy,
  resetAuthInstance,
} from './plugin/index.js'
export type {
  Auth,
  PayloadWithAuth,
  CreateAuthFunction,
  BetterAuthPluginOptions,
  BetterAuthPluginAdminOptions,
  BetterAuthStrategyOptions,
} from './plugin/index.js'

// Auth config detection utility
export { detectAuthConfig } from './utils/detectAuthConfig.js'
export type { AuthDetectionResult } from './utils/detectAuthConfig.js'

// Session utilities
export { getServerSession, getServerUser } from './utils/session.js'
export type { Session } from './utils/session.js'
