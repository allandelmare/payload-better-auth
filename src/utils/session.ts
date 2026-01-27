/**
 * Server-side session utilities
 *
 * @packageDocumentation
 */

import type { BasePayload } from 'payload'
import type { PayloadWithAuth } from '../plugin/index.js'

export type Session = {
  user: {
    id: string
    email: string
    name?: string
    image?: string
    [key: string]: unknown
  }
  session: {
    id: string
    expiresAt: Date
    [key: string]: unknown
  }
}

/**
 * Get the current session from headers.
 *
 * @example
 * ```ts
 * import { headers } from 'next/headers'
 * import { getServerSession } from '@delmare/payload-better-auth'
 *
 * export default async function Page() {
 *   const headersList = await headers()
 *   const session = await getServerSession(payload, headersList)
 *
 *   if (!session) {
 *     redirect('/login')
 *   }
 *
 *   return <div>Hello {session.user.name}</div>
 * }
 * ```
 */
export async function getServerSession(
  payload: BasePayload,
  headers: Headers
): Promise<Session | null> {
  try {
    const payloadWithAuth = payload as PayloadWithAuth

    if (!payloadWithAuth.betterAuth) {
      console.error('[session] Better Auth not initialized')
      return null
    }

    const session = await payloadWithAuth.betterAuth.api.getSession({ headers })
    return session as Session | null
  } catch (error) {
    console.error('[session] Error getting session:', error)
    return null
  }
}

/**
 * Get the current user from the session.
 *
 * @example
 * ```ts
 * import { headers } from 'next/headers'
 * import { getServerUser } from '@delmare/payload-better-auth'
 *
 * export default async function Page() {
 *   const headersList = await headers()
 *   const user = await getServerUser(payload, headersList)
 *
 *   if (!user) {
 *     redirect('/login')
 *   }
 *
 *   return <div>Hello {user.name}</div>
 * }
 * ```
 */
export async function getServerUser(
  payload: BasePayload,
  headers: Headers
): Promise<Session['user'] | null> {
  const session = await getServerSession(payload, headers)
  return session?.user ?? null
}
