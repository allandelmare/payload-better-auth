/**
 * Utility to detect auth configuration in Payload config
 */

import type { Config, CollectionConfig } from 'payload'

export type AuthDetectionResult = {
  /** Whether any collection has disableLocalStrategy: true */
  hasDisableLocalStrategy: boolean
  /** The slug of the auth collection (if found) */
  authCollectionSlug: string | null
  /** The auth collection config (if found) */
  authCollectionConfig: CollectionConfig | null
}

/**
 * Scans Payload config to detect if any collection uses disableLocalStrategy.
 * Used to determine whether to auto-inject admin components.
 */
export function detectAuthConfig(config: Config): AuthDetectionResult {
  const collections = config.collections ?? []

  for (const collection of collections) {
    if (collection.auth) {
      const auth = collection.auth
      // disableLocalStrategy can be `true` or an object with options
      if (
        auth === true ||
        (typeof auth === 'object' && auth.disableLocalStrategy)
      ) {
        return {
          hasDisableLocalStrategy:
            auth === true ||
            (typeof auth === 'object' && !!auth.disableLocalStrategy),
          authCollectionSlug: collection.slug,
          authCollectionConfig: collection,
        }
      }
    }
  }

  return {
    hasDisableLocalStrategy: false,
    authCollectionSlug: null,
    authCollectionConfig: null,
  }
}
