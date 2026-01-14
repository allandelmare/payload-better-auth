/**
 * Client-side auth utilities
 * Re-exports createAuthClient from better-auth/react and common plugins
 */

import { createAuthClient } from 'better-auth/react'
import { twoFactorClient, apiKeyClient } from 'better-auth/client/plugins'
import { passkeyClient } from '@better-auth/passkey/client'

// Re-export for power users who want full control
export { createAuthClient } from 'better-auth/react'
export { twoFactorClient, apiKeyClient } from 'better-auth/client/plugins'
export { passkeyClient } from '@better-auth/passkey/client'

export interface PayloadAuthClientOptions {
  baseURL?: string
}

/**
 * Create a pre-configured auth client with common plugins (twoFactor, apiKey, passkey)
 * @param options - Optional configuration
 * @param options.baseURL - Base URL for auth endpoints (defaults to window.location.origin)
 *
 * Note: Passkey features require installing @better-auth/passkey as a peer dependency
 */
export function createPayloadAuthClient(options?: PayloadAuthClientOptions) {
  return createAuthClient({
    baseURL: options?.baseURL ?? (typeof window !== 'undefined' ? window.location.origin : ''),
    plugins: [twoFactorClient(), apiKeyClient(), passkeyClient()],
  })
}

export type PayloadAuthClient = ReturnType<typeof createPayloadAuthClient>
