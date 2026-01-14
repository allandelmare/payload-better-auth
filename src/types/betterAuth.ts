/**
 * Enhanced TypeScript types for Better Auth integration.
 *
 * Provides improved type inference for the Better Auth instance,
 * including session/user types, API methods, and error codes.
 */

import type { AuthContext } from 'better-auth'
import { router } from 'better-auth/api'
import type {
  BetterAuthOptions,
  BetterAuthPlugin,
  InferAPI,
  InferPluginTypes,
  InferSession,
  InferUser,
} from 'better-auth/types'
import type { BasePayload, Endpoint, PayloadRequest } from 'payload'

/**
 * Base error codes from Better Auth core.
 */
type BaseErrorCodes = {
  FAILED_TO_GET_USER_INFO: string
  USER_ALREADY_EXISTS: string
  INVALID_PASSWORD: string
  FAILED_TO_CREATE_USER: string
  FAILED_TO_CREATE_SESSION: string
  FAILED_TO_UPDATE_USER: string
  FAILED_TO_GET_SESSION: string
  INVALID_EMAIL_OR_PASSWORD: string
  SOCIAL_ACCOUNT_ALREADY_LINKED: string
  PROVIDER_NOT_FOUND: string
  INVALID_TOKEN: string
  ID_TOKEN_NOT_SUPPORTED: string
  FAILED_TO_GET_USER_INFO_OPENID: string
  UNEXPECTED_PROVIDER_RESPONSE: string
  TOKEN_REFRESH_FAILED: string
  FAILED_TO_UNLINK: string
  ACCOUNT_NOT_FOUND: string
  SESSION_EXPIRED: string
  INTERNAL_SERVER_ERROR: string
  VALIDATION_ERROR: string
}

/**
 * Union to intersection utility type.
 */
type UnionToIntersection<U> = (U extends unknown ? (k: U) => void : never) extends (
  k: infer I
) => void
  ? I
  : never

/**
 * Deeply prettify a type for better IDE display.
 * Flattens intersections and preserves functions/arrays/dates.
 */
type PrettifyDeep<T> = {
  [K in keyof T]: T[K] extends (...args: unknown[]) => unknown
    ? T[K]
    : T[K] extends object
      ? T[K] extends Array<unknown>
        ? T[K]
        : T[K] extends Date
          ? T[K]
          : PrettifyDeep<T[K]>
      : T[K]
} & {}

/**
 * Infer error codes from enabled plugins.
 */
type InferPluginErrorCodes<O extends BetterAuthOptions> =
  O['plugins'] extends Array<infer P>
    ? UnionToIntersection<
        P extends BetterAuthPlugin
          ? P['$ERROR_CODES'] extends Record<string, unknown>
            ? P['$ERROR_CODES']
            : never
          : never
      > extends infer R
      ? [R] extends [never]
        ? object
        : R
      : object
    : object

/**
 * Role array type with configurable roles.
 */
export type RoleArray<O extends readonly string[] = readonly ['user']> =
  | O[number][]
  | null

/**
 * Override role field in a type with configured roles.
 */
type OverrideRole<T, O extends readonly string[]> = T extends object
  ? Omit<T, 'role'> & { role: RoleArray<O> }
  : T

/**
 * The return type of a Better Auth instance.
 *
 * This provides full type inference for:
 * - API endpoints and their return types
 * - Session/user types based on enabled plugins
 * - Error codes from all enabled plugins
 * - Auth context for advanced use cases
 *
 * @template O - Better Auth options type for inference
 *
 * @example
 * ```ts
 * // Access inferred types
 * type MySession = typeof payload.betterAuth.$Infer.Session
 *
 * // Type-safe API calls
 * const result = await payload.betterAuth.api.getSession({ headers })
 * ```
 */
export type BetterAuthReturn<O extends BetterAuthOptions = BetterAuthOptions> = {
  /** The request handler for auth endpoints */
  handler: (request: Request) => Promise<Response>
  /** Type-safe API methods */
  api: InferAPI<ReturnType<typeof router<O>>>['endpoints']
  /** The resolved options */
  options: O
  /** All error codes from enabled plugins */
  $ERROR_CODES: InferPluginErrorCodes<O> & BaseErrorCodes
  /** Auth context (async) for advanced use cases */
  $context: Promise<AuthContext>
  /** Inferred types for Session and User */
  $Infer: InferPluginTypes<O> extends { Session: unknown }
    ? InferPluginTypes<O>
    : {
        Session: {
          session: PrettifyDeep<InferSession<O>>
          user: PrettifyDeep<InferUser<O>>
        }
      } & InferPluginTypes<O>
}

/**
 * Payload instance with Better Auth attached.
 *
 * After initialization, the Payload instance is extended with
 * the `betterAuth` property containing the auth instance.
 *
 * @template O - Better Auth options type for inference
 *
 * @example
 * ```ts
 * // In a server action or API route
 * const payload = await getPayload({ config })
 * const payloadWithAuth = payload as PayloadWithAuth
 *
 * const session = await payloadWithAuth.betterAuth.api.getSession({ headers })
 * ```
 */
export type PayloadWithAuth<O extends BetterAuthOptions = BetterAuthOptions> =
  BasePayload & {
    betterAuth: BetterAuthReturn<O>
  }

/**
 * Extended Payload request with Better Auth instance.
 *
 * Use this type in hooks and endpoints to get type-safe
 * access to the Better Auth instance.
 *
 * @template O - Better Auth options type for inference
 *
 * @example
 * ```ts
 * const myHook: CollectionBeforeChangeHook = async ({ req }) => {
 *   const typedReq = req as PayloadRequestWithBetterAuth<typeof myBetterAuthOptions>
 *   const session = await typedReq.payload.betterAuth.api.getSession({
 *     headers: req.headers,
 *   })
 *   // ...
 * }
 * ```
 */
export interface PayloadRequestWithBetterAuth<
  O extends BetterAuthOptions = BetterAuthOptions,
> extends PayloadRequest {
  payload: PayloadWithAuth<O>
}

/**
 * Type utility for collection hooks with Better Auth context.
 *
 * Transforms a standard Payload hook type to include Better Auth
 * on the request's payload instance.
 *
 * @template O - Better Auth options type for inference
 * @template T - The original hook function type
 *
 * @example
 * ```ts
 * import type { CollectionBeforeChangeHook } from 'payload'
 *
 * const beforeChange: CollectionHookWithBetterAuth<
 *   typeof myOptions,
 *   CollectionBeforeChangeHook
 * > = async ({ req, data }) => {
 *   // req.payload.betterAuth is fully typed
 *   const session = await req.payload.betterAuth.api.getSession({
 *     headers: req.headers,
 *   })
 *   return data
 * }
 * ```
 */
export type CollectionHookWithBetterAuth<
  O extends BetterAuthOptions,
  T extends (args: Record<string, unknown>) => unknown,
> = T extends (args: infer A) => infer R
  ? (
      args: Omit<A, 'req'> & { req: PayloadRequestWithBetterAuth<O> }
    ) => R
  : never

/**
 * Payload endpoint type with Better Auth context.
 *
 * Use this for custom endpoints that need access to Better Auth.
 *
 * @template O - Better Auth options type for inference
 *
 * @example
 * ```ts
 * const myEndpoint: EndpointWithBetterAuth<typeof myOptions> = {
 *   path: '/custom-auth',
 *   method: 'post',
 *   handler: async (req) => {
 *     // req.payload.betterAuth is fully typed
 *     const session = await req.payload.betterAuth.api.getSession({
 *       headers: req.headers,
 *     })
 *     return Response.json({ session })
 *   },
 * }
 * ```
 */
export type EndpointWithBetterAuth<O extends BetterAuthOptions> = Omit<
  Endpoint,
  'handler'
> & {
  handler: (req: PayloadRequestWithBetterAuth<O>) => Promise<Response> | Response
}
