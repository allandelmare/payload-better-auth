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
import type { betterAuth, BetterAuthOptions } from 'better-auth'
import { detectAuthConfig } from '../utils/detectAuthConfig.js'
import {
  detectEnabledPlugins,
  type EnabledPluginsResult,
} from '../utils/detectEnabledPlugins.js'
import type { ApiKeyScopesConfig } from '../types/apiKey.js'

export type Auth = ReturnType<typeof betterAuth>
// PayloadWithAuth from types
import type { PayloadWithAuth } from '../types/betterAuth.js'
export type { PayloadWithAuth } from '../types/betterAuth.js'

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
     * Required role(s) for admin access.
     * - string: Single role required (default: 'admin')
     * - string[]: Multiple roles (behavior depends on requireAllRoles)
     * - null: Disable role checking
     */
    requiredRole?: string | string[] | null
    /**
     * When requiredRole is an array, require ALL roles (true) or ANY role (false).
     * Default: false (any matching role grants access)
     */
    requireAllRoles?: boolean
    /** Enable passkey (WebAuthn) sign-in option. Default: false */
    enablePasskey?: boolean
  }
  /** Path to custom logout button component (import map format) */
  logoutButtonComponent?: string
  /** Path to custom BeforeLogin component (import map format) */
  beforeLoginComponent?: string
  /** Path to custom login view component (import map format) */
  loginViewComponent?: string

  /**
   * Enable management UI for security features (2FA, API keys).
   * Management views are auto-injected based on which Better Auth plugins are enabled.
   * @default true
   */
  enableManagementUI?: boolean
  /**
   * Better Auth options - used to detect which plugins are enabled.
   * Required for management UI to auto-detect enabled features.
   */
  betterAuthOptions?: Partial<BetterAuthOptions>
  /** Custom paths for management views */
  managementPaths?: {
    /** Two-factor management view path. Default: '/security/two-factor' */
    twoFactor?: string
    /** API keys management view path. Default: '/security/api-keys' */
    apiKeys?: string
    /** Passkeys management view path. Default: '/security/passkeys' */
    passkeys?: string
  }
  /**
   * API key scopes configuration.
   * Controls which permission scopes are available when creating API keys.
   * When not provided, scopes are auto-generated from Payload collections.
   */
  apiKey?: ApiKeyScopesConfig
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

// Store API key scopes config for access by management views
let apiKeyScopesConfig: ApiKeyScopesConfig | undefined = undefined

/**
 * Get the configured API key scopes config.
 * Used by the ApiKeysView to build available scopes.
 */
export function getApiKeyScopesConfig(): ApiKeyScopesConfig | undefined {
  return apiKeyScopesConfig
}

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

      const response = await auth.handler(request)

      return response
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
          '@delmaredigital/payload-better-auth/rsc#LoginViewWrapper',
        path: '/login' as const,
      }

  const views = {
    ...existingViews,
    ...(newLoginView ? { login: newLoginView } : {}),
  }

  // Store login config in config.custom for the RSC wrapper to read
  const loginConfig = adminOptions.login ?? {}

  return {
    ...config,
    custom: {
      ...config.custom,
      betterAuth: {
        ...(config.custom?.betterAuth as Record<string, unknown> | undefined),
        login: loginConfig,
      },
    },
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
 * Injects management UI components into the Payload config based on enabled plugins.
 */
function injectManagementComponents(
  config: Config,
  options: BetterAuthPluginOptions
): Config {
  const adminOptions = options.admin ?? {}

  // Skip if management UI is disabled
  if (adminOptions.enableManagementUI === false) {
    return config
  }

  // Detect which plugins are enabled
  const enabledPlugins = detectEnabledPlugins(adminOptions.betterAuthOptions)

  // Get custom paths or use defaults
  const paths = {
    twoFactor: adminOptions.managementPaths?.twoFactor ?? '/security/two-factor',
    apiKeys: adminOptions.managementPaths?.apiKeys ?? '/security/api-keys',
    passkeys: adminOptions.managementPaths?.passkeys ?? '/security/passkeys',
  }

  const existingComponents = config.admin?.components ?? {}
  const existingViews =
    (existingComponents.views as Record<string, unknown> | undefined) ?? {}
  const existingAfterNavLinks = existingComponents.afterNavLinks ?? []

  // Build management views based on enabled plugins
  // Note: Sessions and passkeys use Payload's default collection views
  const managementViews: Record<string, { Component: string; path: string }> = {}

  // Two-factor (if enabled)
  if (enabledPlugins.hasTwoFactor) {
    managementViews.securityTwoFactor = {
      Component: '@delmaredigital/payload-better-auth/rsc#TwoFactorView',
      path: paths.twoFactor,
    }
  }

  // API keys (if enabled)
  if (enabledPlugins.hasApiKey) {
    managementViews.securityApiKeys = {
      Component: '@delmaredigital/payload-better-auth/rsc#ApiKeysView',
      path: paths.apiKeys,
    }
  }

  // Passkeys (if enabled)
  if (enabledPlugins.hasPasskey) {
    managementViews.securityPasskeys = {
      Component: '@delmaredigital/payload-better-auth/rsc#PasskeysView',
      path: paths.passkeys,
    }
  }

  // Add SecurityNavLinks to afterNavLinks
  const afterNavLinks = [
    ...(Array.isArray(existingAfterNavLinks)
      ? existingAfterNavLinks
      : [existingAfterNavLinks]),
    '@delmaredigital/payload-better-auth/components/management#SecurityNavLinks',
  ]

  return {
    ...config,
    admin: {
      ...config.admin,
      components: {
        ...existingComponents,
        views: {
          ...existingViews,
          ...managementViews,
        },
        afterNavLinks,
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
 * - Auto-injects management UI for security features based on enabled plugins
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

  // Store API key scopes config for access by management views
  apiKeyScopesConfig = options.admin?.apiKey

  return (incomingConfig) => {
    // Inject admin components if enabled
    let config =
      autoInjectAdminComponents
        ? injectAdminComponents(incomingConfig, options)
        : incomingConfig

    // Inject management UI components
    config = injectManagementComponents(config, options)

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
