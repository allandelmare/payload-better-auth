/**
 * Auto-generate API key scopes from Payload collections.
 */

import type { CollectionConfig } from 'payload'
import type {
  ScopeDefinition,
  ApiKeyScopesConfig,
  AvailableScope,
} from '../types/apiKey.js'

/** Default collections to exclude from auto-generated scopes */
const DEFAULT_EXCLUDED_COLLECTIONS = [
  'sessions',
  'verifications',
  'accounts',
  'twoFactors',
  'apiKeys',
]

/**
 * Capitalize the first letter of a string.
 */
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

/**
 * Convert slug to human-readable label.
 * e.g., 'blog-posts' -> 'Blog Posts'
 */
function slugToLabel(slug: string): string {
  return slug
    .split('-')
    .map(capitalize)
    .join(' ')
}

/**
 * Generate scopes from Payload collections.
 * Creates {collection}:read, {collection}:write, {collection}:delete for each collection.
 */
export function generateScopesFromCollections(
  collections: CollectionConfig[],
  excludeCollections: string[] = DEFAULT_EXCLUDED_COLLECTIONS
): Record<string, ScopeDefinition> {
  const scopes: Record<string, ScopeDefinition> = {}

  for (const collection of collections) {
    if (excludeCollections.includes(collection.slug)) continue

    const slug = collection.slug
    const singularLabel =
      (typeof collection.labels?.singular === 'string'
        ? collection.labels.singular
        : null) ?? slugToLabel(slug)
    const pluralLabel =
      (typeof collection.labels?.plural === 'string'
        ? collection.labels.plural
        : null) ?? slugToLabel(slug) + 's'

    scopes[`${slug}:read`] = {
      label: `Read ${pluralLabel}`,
      description: `View ${pluralLabel.toLowerCase()}`,
      permissions: { [slug]: ['read'] },
    }

    scopes[`${slug}:write`] = {
      label: `Write ${pluralLabel}`,
      description: `Create and edit ${pluralLabel.toLowerCase()}`,
      permissions: { [slug]: ['read', 'create', 'update'] },
    }

    scopes[`${slug}:delete`] = {
      label: `Delete ${pluralLabel}`,
      description: `Delete ${pluralLabel.toLowerCase()}`,
      permissions: { [slug]: ['delete'] },
    }
  }

  return scopes
}

/**
 * Build the final scopes configuration from plugin options and collections.
 * Handles merging custom scopes with auto-generated collection scopes.
 */
export function buildAvailableScopes(
  collections: CollectionConfig[],
  config?: ApiKeyScopesConfig
): AvailableScope[] {
  const customScopes = config?.scopes ?? {}
  const hasCustomScopes = Object.keys(customScopes).length > 0

  // Determine if we should include collection scopes
  // Default: true when no custom scopes, false when custom scopes provided
  const includeCollectionScopes =
    config?.includeCollectionScopes ?? !hasCustomScopes

  const excludeCollections = config?.excludeCollections ?? DEFAULT_EXCLUDED_COLLECTIONS

  // Build the combined scopes object
  let allScopes: Record<string, ScopeDefinition> = {}

  // Add collection scopes if enabled
  if (includeCollectionScopes) {
    allScopes = generateScopesFromCollections(collections, excludeCollections)
  }

  // Add custom scopes (they override collection scopes with same ID)
  for (const [id, scope] of Object.entries(customScopes)) {
    allScopes[id] = scope
  }

  // Convert to array format for the client
  return Object.entries(allScopes).map(([id, scope]) => ({
    id,
    ...scope,
  }))
}

/**
 * Convert selected scopes to Better Auth permission format.
 * Used when creating an API key.
 */
export function scopesToPermissions(
  selectedScopeIds: string[],
  availableScopes: AvailableScope[]
): Record<string, string[]> {
  const permissions: Record<string, string[]> = {}

  for (const scopeId of selectedScopeIds) {
    const scope = availableScopes.find((s) => s.id === scopeId)
    if (!scope) continue

    for (const [resource, actions] of Object.entries(scope.permissions)) {
      if (!permissions[resource]) {
        permissions[resource] = []
      }
      // Add unique actions
      for (const action of actions) {
        if (!permissions[resource].includes(action)) {
          permissions[resource].push(action)
        }
      }
    }
  }

  return permissions
}
