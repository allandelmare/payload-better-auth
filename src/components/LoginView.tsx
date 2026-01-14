'use client'

import { useState, useEffect, type FormEvent } from 'react'
import { useRouter } from 'next/navigation.js'
import {
  createPayloadAuthClient,
  type PayloadAuthClient,
} from '../exports/client'
import { hasAnyRole, hasAllRoles, normalizeRoles } from '../utils/access.js'

export type LoginViewProps = {
  /** Optional pre-configured auth client */
  authClient?: PayloadAuthClient
  /** Custom logo element */
  logo?: React.ReactNode
  /** Login page title. Default: 'Login' */
  title?: string
  /** Path to redirect after successful login. Default: '/admin' */
  afterLoginPath?: string
  /**
   * Required role(s) for admin access.
   * - string: Single role required (default: 'admin')
   * - string[]: Multiple roles (behavior depends on requireAllRoles)
   * - null/undefined: Disable role checking
   * For complex RBAC beyond these options, disable the login view and create your own.
   */
  requiredRole?: string | string[] | null
  /**
   * When requiredRole is an array, require ALL roles (true) or ANY role (false).
   * Default: false (any matching role grants access)
   */
  requireAllRoles?: boolean
  /**
   * Enable passkey (WebAuthn) sign-in option.
   * - true: Always show passkey button
   * - false: Never show passkey button
   * - 'auto' (default): Auto-detect if passkey plugin is available
   */
  enablePasskey?: boolean | 'auto'
}

/**
 * Check if user has the required role(s)
 */
function checkUserRoles(
  user: { role?: unknown } | null | undefined,
  requiredRole: string | string[] | null | undefined,
  requireAllRoles: boolean
): boolean {
  // No role requirement = access granted
  if (!requiredRole) return true

  // No user = access denied
  if (!user) return false

  const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole]

  if (requireAllRoles) {
    return hasAllRoles(user, roles)
  }

  return hasAnyRole(user, roles)
}

/**
 * Full login page component matching Payload's admin theme.
 * Registered as a custom admin view at /admin/login.
 */
export function LoginView({
  authClient: providedClient,
  logo,
  title = 'Login',
  afterLoginPath = '/admin',
  requiredRole = 'admin',
  requireAllRoles = false,
  enablePasskey = 'auto',
}: LoginViewProps) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [passkeyLoading, setPasskeyLoading] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)
  const [accessDenied, setAccessDenied] = useState(false)
  const [passkeyAvailable, setPasskeyAvailable] = useState(enablePasskey === true)

  // Two-factor authentication state
  const [twoFactorRequired, setTwoFactorRequired] = useState(false)
  const [totpCode, setTotpCode] = useState('')
  const [totpLoading, setTotpLoading] = useState(false)

  const getClient = () => providedClient ?? createPayloadAuthClient()

  // Check if user is already logged in on mount
  useEffect(() => {
    async function checkSession() {
      try {
        const client = getClient()
        const result = await client.getSession()

        if (result.data?.user) {
          const user = result.data.user as { role?: unknown }
          // User is logged in, check role
          if (checkUserRoles(user, requiredRole, requireAllRoles)) {
            router.push(afterLoginPath)
            return
          } else {
            setAccessDenied(true)
          }
        }
      } catch {
        // No session, show login form
      }
      setCheckingSession(false)
    }
    checkSession()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [afterLoginPath, requiredRole, requireAllRoles, router])

  // Auto-detect passkey availability if set to 'auto'
  useEffect(() => {
    if (enablePasskey === 'auto') {
      // Check if passkey endpoint exists (GET request)
      // Better Auth passkey routes are at /passkey/* (singular)
      fetch('/api/auth/passkey/generate-authenticate-options', {
        method: 'GET',
        credentials: 'include',
      })
        .then((res) => {
          // If we get a response (even 400/401 for not authenticated), passkey is available
          // 404 means passkey plugin is not installed
          setPasskeyAvailable(res.status !== 404)
        })
        .catch(() => {
          setPasskeyAvailable(false)
        })
    } else {
      setPasskeyAvailable(enablePasskey === true)
    }
  }, [enablePasskey])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setAccessDenied(false)

    try {
      const client = getClient()
      const result = await client.signIn.email({
        email,
        password,
      })

      // Check if 2FA is required (use 'in' operator for proper TypeScript inference)
      if (result.data && 'twoFactorRedirect' in result.data && result.data.twoFactorRedirect) {
        setTwoFactorRequired(true)
        setLoading(false)
        return
      }

      if (result.error) {
        setError(result.error.message ?? 'Invalid credentials')
        setLoading(false)
        return
      }

      if (result.data?.user) {
        const user = result.data.user as { role?: unknown }
        // Check role if required
        if (!checkUserRoles(user, requiredRole, requireAllRoles)) {
          setAccessDenied(true)
          setLoading(false)
          return
        }

        router.push(afterLoginPath)
        router.refresh()
      }
    } catch {
      setError('An error occurred. Please try again.')
      setLoading(false)
    }
  }

  async function handleTotpVerify(e: FormEvent) {
    e.preventDefault()
    setTotpLoading(true)
    setError(null)

    try {
      const client = getClient()
      const result = await client.twoFactor.verifyTotp({ code: totpCode })

      if (result.error) {
        setError(result.error.message ?? 'Invalid verification code')
        setTotpLoading(false)
        return
      }

      // Verify-totp may not return all user fields (like custom 'role')
      // Fetch the session to get complete user data for role check
      if (requiredRole) {
        const sessionResult = await client.getSession()
        if (sessionResult.data?.user) {
          const user = sessionResult.data.user as { role?: unknown }
          if (!checkUserRoles(user, requiredRole, requireAllRoles)) {
            setAccessDenied(true)
            setTotpLoading(false)
            return
          }
        }
      }

      router.push(afterLoginPath)
      router.refresh()
    } catch {
      setError('An error occurred. Please try again.')
      setTotpLoading(false)
    }
  }

  function handleBackToLogin() {
    setTwoFactorRequired(false)
    setTotpCode('')
    setError(null)
  }

  async function handlePasskeySignIn() {
    if (!passkeyAvailable) return

    setPasskeyLoading(true)
    setError(null)
    setAccessDenied(false)

    try {
      const client = getClient()
      const result = await client.signIn.passkey()

      if (result.error) {
        setError(result.error.message ?? 'Passkey authentication failed')
        setPasskeyLoading(false)
        return
      }

      // Passkey sign-in succeeded - fetch session to get full user data (including role)
      // This is more reliable than checking result.data.user which may vary by SDK version
      const sessionResult = await client.getSession()

      if (sessionResult.data?.user) {
        const user = sessionResult.data.user as { role?: unknown }
        // Check role if required
        if (!checkUserRoles(user, requiredRole, requireAllRoles)) {
          setAccessDenied(true)
          setPasskeyLoading(false)
          return
        }

        router.push(afterLoginPath)
        router.refresh()
      } else {
        // Session fetch failed - shouldn't happen after successful passkey auth
        setError('Authentication succeeded but session could not be verified')
        setPasskeyLoading(false)
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'NotAllowedError') {
        setError('Passkey authentication was cancelled or not allowed')
      } else {
        setError(err instanceof Error ? err.message : 'Passkey authentication failed')
      }
      setPasskeyLoading(false)
    }
  }

  async function handleSignOut() {
    const client = getClient()
    await client.signOut()
    setAccessDenied(false)
    router.refresh()
  }

  // Loading state while checking session
  if (checkingSession) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--theme-bg)',
        }}
      >
        <div style={{ color: 'var(--theme-text)', opacity: 0.7 }}>
          Loading...
        </div>
      </div>
    )
  }

  // Access denied state
  if (accessDenied) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--theme-bg)',
          padding: 'var(--base)',
        }}
      >
        <div
          style={{
            background: 'var(--theme-elevation-50)',
            padding: 'calc(var(--base) * 2)',
            borderRadius: 'var(--style-radius-m)',
            boxShadow: '0 2px 20px rgba(0, 0, 0, 0.1)',
            width: '100%',
            maxWidth: '400px',
            textAlign: 'center',
          }}
        >
          <h1
            style={{
              color: 'var(--theme-error-500)',
              fontSize: 'var(--font-size-h3)',
              fontWeight: 600,
              margin: '0 0 var(--base) 0',
            }}
          >
            Access Denied
          </h1>
          <p
            style={{
              color: 'var(--theme-text)',
              opacity: 0.8,
              marginBottom: 'calc(var(--base) * 1.5)',
              fontSize: 'var(--font-size-small)',
            }}
          >
            You don't have permission to access the admin panel.
            Please contact an administrator if you believe this is an error.
          </p>
          <button
            onClick={handleSignOut}
            style={{
              padding: 'calc(var(--base) * 0.75) calc(var(--base) * 1.5)',
              background: 'var(--theme-elevation-150)',
              border: 'none',
              borderRadius: 'var(--style-radius-s)',
              color: 'var(--theme-text)',
              fontSize: 'var(--font-size-base)',
              cursor: 'pointer',
            }}
          >
            Sign out and try again
          </button>
        </div>
      </div>
    )
  }

  // Two-factor verification view
  if (twoFactorRequired) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--theme-bg)',
          padding: 'var(--base)',
        }}
      >
        <div
          style={{
            background: 'var(--theme-elevation-50)',
            padding: 'calc(var(--base) * 2)',
            borderRadius: 'var(--style-radius-m)',
            boxShadow: '0 2px 20px rgba(0, 0, 0, 0.1)',
            width: '100%',
            maxWidth: '400px',
          }}
        >
          {logo && (
            <div
              style={{
                textAlign: 'center',
                marginBottom: 'calc(var(--base) * 1.5)',
              }}
            >
              {logo}
            </div>
          )}

          <h1
            style={{
              color: 'var(--theme-text)',
              fontSize: 'var(--font-size-h3)',
              fontWeight: 600,
              margin: '0 0 calc(var(--base) * 0.5) 0',
              textAlign: 'center',
            }}
          >
            Two-Factor Authentication
          </h1>

          <p
            style={{
              color: 'var(--theme-text)',
              opacity: 0.7,
              fontSize: 'var(--font-size-small)',
              textAlign: 'center',
              marginBottom: 'calc(var(--base) * 1.5)',
            }}
          >
            Enter the 6-digit code from your authenticator app
          </p>

          <form onSubmit={handleTotpVerify}>
            <div style={{ marginBottom: 'calc(var(--base) * 1.5)' }}>
              <label
                htmlFor="totp-code"
                style={{
                  display: 'block',
                  color: 'var(--theme-text)',
                  marginBottom: 'calc(var(--base) * 0.5)',
                  fontSize: 'var(--font-size-small)',
                  fontWeight: 500,
                }}
              >
                Verification Code
              </label>
              <input
                id="totp-code"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="one-time-code"
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                required
                placeholder="000000"
                style={{
                  width: '100%',
                  padding: 'calc(var(--base) * 0.75)',
                  background: 'var(--theme-input-bg)',
                  border: '1px solid var(--theme-elevation-150)',
                  borderRadius: 'var(--style-radius-s)',
                  color: 'var(--theme-text)',
                  fontSize: 'var(--font-size-h4)',
                  fontFamily: 'monospace',
                  textAlign: 'center',
                  letterSpacing: '0.5em',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {error && (
              <div
                style={{
                  color: 'var(--theme-error-500)',
                  marginBottom: 'var(--base)',
                  fontSize: 'var(--font-size-small)',
                  padding: 'calc(var(--base) * 0.5)',
                  background: 'var(--theme-error-50)',
                  borderRadius: 'var(--style-radius-s)',
                  border: '1px solid var(--theme-error-200)',
                }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={totpLoading || totpCode.length !== 6}
              style={{
                width: '100%',
                padding: 'calc(var(--base) * 0.75)',
                background: 'var(--theme-elevation-800)',
                border: 'none',
                borderRadius: 'var(--style-radius-s)',
                color: 'var(--theme-elevation-50)',
                fontSize: 'var(--font-size-base)',
                fontWeight: 500,
                cursor: totpLoading || totpCode.length !== 6 ? 'not-allowed' : 'pointer',
                opacity: totpLoading || totpCode.length !== 6 ? 0.7 : 1,
                transition: 'opacity 150ms ease',
              }}
            >
              {totpLoading ? 'Verifying...' : 'Verify'}
            </button>
          </form>

          <button
            type="button"
            onClick={handleBackToLogin}
            style={{
              width: '100%',
              marginTop: 'var(--base)',
              padding: 'calc(var(--base) * 0.5)',
              background: 'transparent',
              border: 'none',
              color: 'var(--theme-text)',
              opacity: 0.7,
              fontSize: 'var(--font-size-small)',
              cursor: 'pointer',
            }}
          >
            ← Back to login
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--theme-bg)',
        padding: 'var(--base)',
      }}
    >
      <div
        style={{
          background: 'var(--theme-elevation-50)',
          padding: 'calc(var(--base) * 2)',
          borderRadius: 'var(--style-radius-m)',
          boxShadow: '0 2px 20px rgba(0, 0, 0, 0.1)',
          width: '100%',
          maxWidth: '400px',
        }}
      >
        {logo && (
          <div
            style={{
              textAlign: 'center',
              marginBottom: 'calc(var(--base) * 1.5)',
            }}
          >
            {logo}
          </div>
        )}

        <h1
          style={{
            color: 'var(--theme-text)',
            fontSize: 'var(--font-size-h3)',
            fontWeight: 600,
            marginBottom: 'calc(var(--base) * 1.5)',
            textAlign: 'center',
            margin: '0 0 calc(var(--base) * 1.5) 0',
          }}
        >
          {title}
        </h1>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 'var(--base)' }}>
            <label
              htmlFor="email"
              style={{
                display: 'block',
                color: 'var(--theme-text)',
                marginBottom: 'calc(var(--base) * 0.5)',
                fontSize: 'var(--font-size-small)',
                fontWeight: 500,
              }}
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              style={{
                width: '100%',
                padding: 'calc(var(--base) * 0.75)',
                background: 'var(--theme-input-bg)',
                border: '1px solid var(--theme-elevation-150)',
                borderRadius: 'var(--style-radius-s)',
                color: 'var(--theme-text)',
                fontSize: 'var(--font-size-base)',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ marginBottom: 'calc(var(--base) * 1.5)' }}>
            <label
              htmlFor="password"
              style={{
                display: 'block',
                color: 'var(--theme-text)',
                marginBottom: 'calc(var(--base) * 0.5)',
                fontSize: 'var(--font-size-small)',
                fontWeight: 500,
              }}
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              style={{
                width: '100%',
                padding: 'calc(var(--base) * 0.75)',
                background: 'var(--theme-input-bg)',
                border: '1px solid var(--theme-elevation-150)',
                borderRadius: 'var(--style-radius-s)',
                color: 'var(--theme-text)',
                fontSize: 'var(--font-size-base)',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {error && (
            <div
              style={{
                color: 'var(--theme-error-500)',
                marginBottom: 'var(--base)',
                fontSize: 'var(--font-size-small)',
                padding: 'calc(var(--base) * 0.5)',
                background: 'var(--theme-error-50)',
                borderRadius: 'var(--style-radius-s)',
                border: '1px solid var(--theme-error-200)',
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || passkeyLoading}
            style={{
              width: '100%',
              padding: 'calc(var(--base) * 0.75)',
              background: 'var(--theme-elevation-800)',
              border: 'none',
              borderRadius: 'var(--style-radius-s)',
              color: 'var(--theme-elevation-50)',
              fontSize: 'var(--font-size-base)',
              fontWeight: 500,
              cursor: loading || passkeyLoading ? 'not-allowed' : 'pointer',
              opacity: loading || passkeyLoading ? 0.7 : 1,
              transition: 'opacity 150ms ease',
            }}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        {passkeyAvailable && (
          <>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                margin: 'calc(var(--base) * 1.5) 0',
                gap: 'calc(var(--base) * 1)',
              }}
            >
              <div
                style={{
                  flex: 1,
                  height: '1px',
                  background: 'var(--theme-elevation-150)',
                }}
              />
              <span
                style={{
                  color: 'var(--theme-text)',
                  opacity: 0.6,
                  fontSize: 'var(--font-size-small)',
                }}
              >
                or
              </span>
              <div
                style={{
                  flex: 1,
                  height: '1px',
                  background: 'var(--theme-elevation-150)',
                }}
              />
            </div>

            <button
              type="button"
              onClick={handlePasskeySignIn}
              disabled={loading || passkeyLoading}
              style={{
                width: '100%',
                padding: 'calc(var(--base) * 0.75)',
                background: 'transparent',
                border: '1px solid var(--theme-elevation-300)',
                borderRadius: 'var(--style-radius-s)',
                color: 'var(--theme-text)',
                fontSize: 'var(--font-size-base)',
                fontWeight: 500,
                cursor: loading || passkeyLoading ? 'not-allowed' : 'pointer',
                opacity: loading || passkeyLoading ? 0.7 : 1,
                transition: 'opacity 150ms ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 'calc(var(--base) * 0.5)',
              }}
            >
              <span style={{ fontSize: '18px' }}>🔐</span>
              {passkeyLoading ? 'Authenticating...' : 'Sign in with Passkey'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export default LoginView
