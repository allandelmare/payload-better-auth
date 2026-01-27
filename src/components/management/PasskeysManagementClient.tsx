'use client'

import { useState, useEffect, type FormEvent } from 'react'
import {
  createPayloadAuthClient,
  type PayloadAuthClient,
} from '../../exports/client.js'

type PasskeyItem = {
  id: string
  name?: string | null
  credentialID?: string
  createdAt: Date
  lastUsedAt?: Date | null
}

export type PasskeysManagementClientProps = {
  /** Optional pre-configured auth client */
  authClient?: PayloadAuthClient
  /** Page title. Default: 'Passkeys' */
  title?: string
}

/**
 * Client component for passkey management.
 * Lists, registers, and deletes passkeys.
 */
export function PasskeysManagementClient({
  authClient: providedClient,
  title = 'Passkeys',
}: PasskeysManagementClientProps = {}) {
  const [passkeys, setPasskeys] = useState<PasskeyItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [registering, setRegistering] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [showRegisterForm, setShowRegisterForm] = useState(false)
  const [passkeyName, setPasskeyName] = useState('')

  const getClient = () => providedClient ?? createPayloadAuthClient()

  useEffect(() => {
    fetchPasskeys()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function fetchPasskeys() {
    setLoading(true)
    setError(null)

    try {
      const client = getClient()
      const result = await client.passkey.listUserPasskeys()

      if (result.error) {
        setError(result.error.message ?? 'Failed to load passkeys')
      } else {
        setPasskeys((result.data as PasskeyItem[]) ?? [])
      }
    } catch {
      setError('Failed to load passkeys')
    } finally {
      setLoading(false)
    }
  }

  async function handleRegister(e: FormEvent) {
    e.preventDefault()
    setRegistering(true)
    setError(null)
    setSuccess(null)

    try {
      const client = getClient()
      const result = await client.passkey.addPasskey({
        name: passkeyName || undefined,
      })

      if (result.error) {
        setError(result.error.message ?? 'Failed to register passkey')
      } else {
        setSuccess('Passkey registered successfully!')
        setShowRegisterForm(false)
        setPasskeyName('')
        fetchPasskeys()
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'NotAllowedError') {
        setError('Passkey registration was cancelled or not allowed')
      } else if (err instanceof Error && err.name === 'InvalidStateError') {
        setError('This passkey is already registered')
      } else {
        setError(err instanceof Error ? err.message : 'Failed to register passkey')
      }
    } finally {
      setRegistering(false)
    }
  }

  async function handleDelete(passkeyId: string) {
    if (!confirm('Are you sure you want to delete this passkey?')) {
      return
    }

    setDeleting(passkeyId)
    setError(null)
    setSuccess(null)

    try {
      const client = getClient()
      const result = await client.passkey.deletePasskey({ id: passkeyId })

      if (result.error) {
        setError(result.error.message ?? 'Failed to delete passkey')
      } else {
        setPasskeys((prev) => prev.filter((p) => p.id !== passkeyId))
        setSuccess('Passkey deleted successfully')
      }
    } catch {
      setError('Failed to delete passkey')
    } finally {
      setDeleting(null)
    }
  }

  function formatDate(date?: Date | string | null) {
    if (!date) return 'Never'
    const d = date instanceof Date ? date : new Date(date)
    return d.toLocaleString()
  }

  return (
    <div
      style={{
        maxWidth: '900px',
        margin: '0 auto',
        padding: 'calc(var(--base) * 2)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 'calc(var(--base) * 2)',
        }}
      >
        <div>
          <h1
            style={{
              color: 'var(--theme-text)',
              fontSize: 'var(--font-size-h2)',
              fontWeight: 600,
              margin: 0,
            }}
          >
            {title}
          </h1>
          <p
            style={{
              color: 'var(--theme-text)',
              opacity: 0.7,
              fontSize: 'var(--font-size-small)',
              margin: 'calc(var(--base) * 0.5) 0 0 0',
            }}
          >
            Passkeys provide secure, passwordless sign-in using your device's
            biometrics or security keys.
          </p>
        </div>

        <button
          onClick={() => setShowRegisterForm(true)}
          style={{
            padding: 'calc(var(--base) * 0.5) calc(var(--base) * 1)',
            background: 'var(--theme-elevation-800)',
            border: 'none',
            borderRadius: 'var(--style-radius-s)',
            color: 'var(--theme-elevation-50)',
            fontSize: 'var(--font-size-small)',
            cursor: 'pointer',
          }}
        >
          Add Passkey
        </button>
      </div>

      {error && (
        <div
          style={{
            color: 'var(--theme-error-500)',
            marginBottom: 'var(--base)',
            fontSize: 'var(--font-size-small)',
            padding: 'calc(var(--base) * 0.75)',
            background: 'var(--theme-error-50)',
            borderRadius: 'var(--style-radius-s)',
            border: '1px solid var(--theme-error-200)',
          }}
        >
          {error}
        </div>
      )}

      {success && (
        <div
          style={{
            color: 'var(--theme-success-700)',
            marginBottom: 'var(--base)',
            fontSize: 'var(--font-size-small)',
            padding: 'calc(var(--base) * 0.75)',
            background: 'var(--theme-success-50)',
            borderRadius: 'var(--style-radius-s)',
            border: '1px solid var(--theme-success-200)',
          }}
        >
          {success}
        </div>
      )}

      {showRegisterForm && (
        <div
          style={{
            marginBottom: 'calc(var(--base) * 1.5)',
            padding: 'calc(var(--base) * 1.5)',
            background: 'var(--theme-elevation-50)',
            borderRadius: 'var(--style-radius-m)',
            border: '1px solid var(--theme-elevation-100)',
          }}
        >
          <h2
            style={{
              color: 'var(--theme-text)',
              fontSize: 'var(--font-size-h4)',
              fontWeight: 500,
              margin: '0 0 var(--base) 0',
            }}
          >
            Register New Passkey
          </h2>
          <form onSubmit={handleRegister}>
            <div style={{ marginBottom: 'var(--base)' }}>
              <label
                style={{
                  display: 'block',
                  color: 'var(--theme-text)',
                  fontSize: 'var(--font-size-small)',
                  marginBottom: 'calc(var(--base) * 0.25)',
                }}
              >
                Name (optional)
              </label>
              <input
                type="text"
                value={passkeyName}
                onChange={(e) => setPasskeyName(e.target.value)}
                placeholder="e.g., MacBook Pro, iPhone"
                style={{
                  width: '100%',
                  padding: 'calc(var(--base) * 0.5)',
                  background: 'var(--theme-input-bg)',
                  border: '1px solid var(--theme-elevation-150)',
                  borderRadius: 'var(--style-radius-s)',
                  color: 'var(--theme-text)',
                  boxSizing: 'border-box',
                }}
              />
              <p
                style={{
                  color: 'var(--theme-text)',
                  opacity: 0.6,
                  fontSize: 'var(--font-size-small)',
                  margin: 'calc(var(--base) * 0.25) 0 0 0',
                }}
              >
                Your browser will prompt you to use your device's biometrics or
                security key.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 'calc(var(--base) * 0.5)' }}>
              <button
                type="submit"
                disabled={registering}
                style={{
                  padding: 'calc(var(--base) * 0.5) calc(var(--base) * 1)',
                  background: 'var(--theme-elevation-800)',
                  border: 'none',
                  borderRadius: 'var(--style-radius-s)',
                  color: 'var(--theme-elevation-50)',
                  fontSize: 'var(--font-size-small)',
                  cursor: registering ? 'not-allowed' : 'pointer',
                  opacity: registering ? 0.7 : 1,
                }}
              >
                {registering ? 'Registering...' : 'Register Passkey'}
              </button>
              <button
                type="button"
                onClick={() => setShowRegisterForm(false)}
                style={{
                  padding: 'calc(var(--base) * 0.5) calc(var(--base) * 1)',
                  background: 'transparent',
                  border: '1px solid var(--theme-elevation-200)',
                  borderRadius: 'var(--style-radius-s)',
                  color: 'var(--theme-text)',
                  fontSize: 'var(--font-size-small)',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div
          style={{
            color: 'var(--theme-text)',
            opacity: 0.7,
            textAlign: 'center',
            padding: 'calc(var(--base) * 3)',
          }}
        >
          Loading passkeys...
        </div>
      ) : passkeys.length === 0 ? (
        <div
          style={{
            color: 'var(--theme-text)',
            opacity: 0.7,
            textAlign: 'center',
            padding: 'calc(var(--base) * 3)',
          }}
        >
          No passkeys registered. Add one to enable passwordless sign-in.
        </div>
      ) : (
        <div
          style={{
            background: 'var(--theme-elevation-50)',
            borderRadius: 'var(--style-radius-m)',
            overflow: 'hidden',
            border: '1px solid var(--theme-elevation-100)',
          }}
        >
          {passkeys.map((pk, index) => (
            <div
              key={pk.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: 'calc(var(--base) * 1)',
                borderBottom:
                  index < passkeys.length - 1
                    ? '1px solid var(--theme-elevation-100)'
                    : 'none',
              }}
            >
              <div>
                <div
                  style={{
                    color: 'var(--theme-text)',
                    fontWeight: 500,
                    marginBottom: 'calc(var(--base) * 0.25)',
                  }}
                >
                  {pk.name || 'Passkey'}
                </div>
                <div
                  style={{
                    color: 'var(--theme-elevation-600)',
                    fontSize: 'var(--font-size-small)',
                  }}
                >
                  <span>Created: {formatDate(pk.createdAt)}</span>
                  {pk.lastUsedAt && (
                    <span> | Last used: {formatDate(pk.lastUsedAt)}</span>
                  )}
                </div>
              </div>

              <button
                onClick={() => handleDelete(pk.id)}
                disabled={deleting === pk.id}
                style={{
                  padding: 'calc(var(--base) * 0.5) calc(var(--base) * 0.75)',
                  background: 'transparent',
                  border: '1px solid var(--theme-error-300)',
                  borderRadius: 'var(--style-radius-s)',
                  color: 'var(--theme-error-500)',
                  fontSize: 'var(--font-size-small)',
                  cursor: deleting === pk.id ? 'not-allowed' : 'pointer',
                  opacity: deleting === pk.id ? 0.7 : 1,
                }}
              >
                {deleting === pk.id ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default PasskeysManagementClient
