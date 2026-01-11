/**
 * Payload Plugins for Better Auth
 *
 * @packageDocumentation
 */

import type {
  Plugin,
  AuthStrategy,
  Payload,
  BasePayload,
  Endpoint,
  PayloadHandler,
  Config,
} from 'payload'
import type { betterAuth } from 'better-auth'
import { detectAuthConfig } from '../utils/detectAuthConfig.js'

export type Auth = ReturnType<typeof betterAuth>
export type PayloadWithAuth = BasePayload & { betterAuth: Auth }

export type CreateAuthFunction = (payload: BasePayload) => Auth

export type BetterAuthPluginAdminOptions = {
  /** Disable auto-injection of logout button */
  disableLogoutButton?: boolean
  /** Disable auto-injection of BeforeLogin redirect */
  disableBeforeLogin?: boolean
  /** Disable auto-injection of login view */
  disableLoginView?: boolean
  /** Login page customization */
  login?: {
    /** Custom title for login page */
    title?: string
    /** Path to redirect after successful login. Default: '/admin' */
    afterLoginPath?: string
    /**
     * Required role for admin access. Default: 'admin'.
     * Set to null to disable role checking.
     * For complex RBAC (multiple roles, permissions), disable the login view
     * and create your own with custom logic.
     */
    requiredRole?: string | null
  }
  /** Path to custom logout button component (import map format) */
  logoutButtonComponent?: string
  /** Path to custom BeforeLogin component (import map format) */
  beforeLoginComponent?: string
  /** Path to custom login view component (import map format) */
  loginViewComponent?: string
}

export type BetterAuthPluginOptions = {
  /**
   * Function that creates the Better Auth instance.
   * Called during Payload's onInit lifecycle.
   */
  createAuth: CreateAuthFunction

  /**
   * Base path for auth API endpoints (registered via Payload endpoints).
   * @default '/auth'
   */
  authBasePath?: string

  /**
   * Auto-register auth API endpoints via Payload's endpoint system.
   * Set to false if you need custom route-level handling (rare).
   * Note: All Better Auth customization (hooks, plugins, callbacks)
   * is done in createAuth - the route handler is just a passthrough.
   * @default true
   */
  autoRegisterEndpoints?: boolean

  /**
   * Auto-inject admin components when disableLocalStrategy is detected.
   * @default true
   */
  autoInjectAdminComponents?: boolean

  /**
   * Admin UI customization options.
   */
  admin?: BetterAuthPluginAdminOptions
}

// Track auth instance for HMR
let authInstance: Auth | null = null

/**
 * Creates the auth endpoint handler that proxies requests to Better Auth.
 */
function createAuthEndpointHandler(): PayloadHandler {
  return async (req) => {
    const payloadWithAuth = req.payload as PayloadWithAuth
    const auth = payloadWithAuth.betterAuth

    if (!auth) {
      return new Response(
        JSON.stringify({ error: 'Better Auth not initialized' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    try {
      // Construct the full URL for Better Auth
      // PayloadRequest provides these properties
      const protocol = req.headers.get('x-forwarded-proto') || 'http'
      const host = req.headers.get('host') || 'localhost'
      const pathname = (req as unknown as { pathname?: string }).pathname || ''
      const search =
        (req as unknown as { search?: string }).search ||
        (req as unknown as { url?: string }).url?.split('?')[1] ||
        ''

      const url = new URL(pathname, `${protocol}://${host}`)
      if (search) {
        url.search = search.startsWith('?') ? search : `?${search}`
      }

      // Get request body for non-GET methods
      let body: string | undefined
      if (req.method && !['GET', 'HEAD'].includes(req.method)) {
        try {
          // Try to get body from request
          if (typeof (req as unknown as { text?: () => Promise<string> }).text === 'function') {
            body = await (req as unknown as { text: () => Promise<string> }).text()
          } else if ((req as unknown as { data?: unknown }).data) {
            body = JSON.stringify((req as unknown as { data: unknown }).data)
          }
        } catch {
          // Body might already be consumed, try data property
          if ((req as unknown as { data?: unknown }).data) {
            body = JSON.stringify((req as unknown as { data: unknown }).data)
          }
        }
      }

      // Create a new Request for Better Auth
      const request = new Request(url.toString(), {
        method: req.method || 'GET',
        headers: req.headers,
        body,
      })

      return auth.handler(request)
    } catch (error) {
      console.error('[better-auth] Endpoint handler error:', error)
      return new Response(
        JSON.stringify({ error: 'Internal server error' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }
  }
}

/**
 * Generates Payload endpoints for Better Auth.
 */
function generateAuthEndpoints(basePath: string): Endpoint[] {
  const handler = createAuthEndpointHandler()
  const methods = ['get', 'post', 'patch', 'put', 'delete'] as const

  return methods.map((method) => ({
    path: `${basePath}/:path*`,
    method,
    handler,
  }))
}

/**
 * Injects admin components into the Payload config when disableLocalStrategy is detected.
 */
function injectAdminComponents(
  config: Config,
  options: BetterAuthPluginOptions
): Config {
  const authDetection = detectAuthConfig(config)

  // Skip if not using disableLocalStrategy or auto-injection is disabled
  if (
    !authDetection.hasDisableLocalStrategy ||
    options.autoInjectAdminComponents === false
  ) {
    return config
  }

  const adminOptions = options.admin ?? {}
  const existingComponents = config.admin?.components ?? {}

  // Build logout button config
  const logoutButton = adminOptions.disableLogoutButton
    ? (existingComponents.logout as { Button?: string })?.Button
    : adminOptions.logoutButtonComponent ??
      '@delmaredigital/payload-better-auth/components#LogoutButton'

  // Build beforeLogin config
  const existingBeforeLogin = existingComponents.beforeLogin ?? []
  const beforeLogin = adminOptions.disableBeforeLogin
    ? existingBeforeLogin
    : [
        ...(Array.isArray(existingBeforeLogin)
          ? existingBeforeLogin
          : [existingBeforeLogin]),
        adminOptions.beforeLoginComponent ??
          '@delmaredigital/payload-better-auth/components#BeforeLogin',
      ]

  // Build login view config
  const existingViews =
    (existingComponents.views as Record<string, unknown> | undefined) ?? {}
  const newLoginView = adminOptions.disableLoginView
    ? undefined
    : {
        Component:
          adminOptions.loginViewComponent ??
          '@delmaredigital/payload-better-auth/components#LoginView',
        path: '/login' as const,
      }

  const views = {
    ...existingViews,
    ...(newLoginView ? { login: newLoginView } : {}),
  }

  return {
    ...config,
    admin: {
      ...config.admin,
      components: {
        ...existingComponents,
        logout: logoutButton
          ? {
              ...(typeof existingComponents.logout === 'object'
                ? existingComponents.logout
                : {}),
              Button: logoutButton,
            }
          : existingComponents.logout,
        beforeLogin,
        views,
      },
    },
  } as Config
}

/**
 * Payload plugin that initializes Better Auth.
 *
 * Better Auth is created in onInit (after Payload is ready) to avoid
 * circular dependency issues. The auth instance is then attached to
 * payload.betterAuth for access throughout the app.
 *
 * Features:
 * - Auto-registers auth API endpoints (configurable)
 * - Auto-injects admin components when disableLocalStrategy is detected
 * - Handles HMR gracefully
 *
 * @example
 * ```ts
 * import { createBetterAuthPlugin } from '@delmaredigital/payload-better-auth/plugin'
 *
 * export default buildConfig({
 *   plugins: [
 *     createBetterAuthPlugin({
 *       createAuth: (payload) => betterAuth({
 *         database: payloadAdapter({ payloadClient: payload, ... }),
 *         // ... other options
 *       }),
 *     }),
 *   ],
 * })
 * ```
 */
export function createBetterAuthPlugin(
  options: BetterAuthPluginOptions
): Plugin {
  const {
    createAuth,
    authBasePath = '/auth',
    autoRegisterEndpoints = true,
    autoInjectAdminComponents = true,
  } = options

  return (incomingConfig) => {
    // Inject admin components if enabled
    let config =
      autoInjectAdminComponents
        ? injectAdminComponents(incomingConfig, options)
        : incomingConfig

    // Generate auth endpoints if enabled
    const authEndpoints = autoRegisterEndpoints
      ? generateAuthEndpoints(authBasePath)
      : []

    // Merge endpoints
    const existingEndpoints = config.endpoints ?? []

    // Get existing onInit
    const existingOnInit = config.onInit

    return {
      ...config,
      endpoints: [...existingEndpoints, ...authEndpoints],
      onInit: async (payload) => {
        if (existingOnInit) {
          await existingOnInit(payload)
        }

        // Check if already attached (HMR scenario)
        if ('betterAuth' in payload) {
          return
        }

        // Reuse or create auth instance
        if (!authInstance) {
          try {
            authInstance = createAuth(payload)
          } catch (error) {
            console.error('[better-auth] Failed to create auth:', error)
            throw error
          }
        }

        // Attach to payload for global access
        Object.defineProperty(payload, 'betterAuth', {
          value: authInstance,
          writable: false,
          enumerable: false,
          configurable: false,
        })
      },
    }
  }
}

export type BetterAuthStrategyOptions = {
  /**
   * The collection slug for users
   * Default: 'users'
   */
  usersCollection?: string
}

/**
 * Payload auth strategy that uses Better Auth for authentication.
 *
 * Use this in your Users collection to authenticate via Better Auth sessions.
 *
 * @example
 * ```ts
 * import { betterAuthStrategy } from '@delmaredigital/payload-better-auth/plugin'
 *
 * export const Users: CollectionConfig = {
 *   slug: 'users',
 *   auth: {
 *     disableLocalStrategy: true,
 *     strategies: [betterAuthStrategy()],
 *   },
 *   // ...
 * }
 * ```
 */
export function betterAuthStrategy(
  options: BetterAuthStrategyOptions = {}
): AuthStrategy {
  const { usersCollection = 'users' } = options

  return {
    name: 'better-auth',
    authenticate: async ({
      payload,
      headers,
    }: {
      payload: Payload
      headers: Headers
    }) => {
      try {
        const payloadWithAuth = payload as PayloadWithAuth
        const auth = payloadWithAuth.betterAuth

        if (!auth) {
          console.error('Better Auth not initialized on payload instance')
          return { user: null }
        }

        const session = await auth.api.getSession({ headers })

        if (!session?.user?.id) {
          return { user: null }
        }

        const users = await payload.find({
          collection: usersCollection,
          where: { id: { equals: session.user.id } },
          limit: 1,
          depth: 0,
        })

        if (users.docs.length === 0) {
          return { user: null }
        }

        return {
          user: {
            ...users.docs[0],
            collection: usersCollection,
            _strategy: 'better-auth',
          },
        }
      } catch (error) {
        console.error('Better Auth strategy error:', error)
        return { user: null }
      }
    },
  }
}

/**
 * Reset the auth instance (useful for testing)
 */
export function resetAuthInstance(): void {
  authInstance = null
}
