'use client'

import { useState, useEffect, type FormEvent } from 'react'
import {
  createPayloadAuthClient,
  type PayloadAuthClient,
} from '../../exports/client'

export type TwoFactorManagementClientProps = {
  /** Optional pre-configured auth client */
  authClient?: PayloadAuthClient
  /** Page title. Default: 'Two-Factor Authentication' */
  title?: string
}

/**
 * Client component for two-factor authentication management.
 * Shows 2FA status and allows enabling/disabling.
 */
export function TwoFactorManagementClient({
  authClient: providedClient,
  title = 'Two-Factor Authentication',
}: TwoFactorManagementClientProps = {}) {
  const [isEnabled, setIsEnabled] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [step, setStep] = useState<'status' | 'password' | 'setup' | 'verify' | 'backup'>('status')
  const [totpUri, setTotpUri] = useState<string | null>(null)
  const [secret, setSecret] = useState<string | null>(null)
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  const [verificationCode, setVerificationCode] = useState('')
  const [password, setPassword] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  const getClient = () => providedClient ?? createPayloadAuthClient()

  useEffect(() => {
    checkStatus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function checkStatus() {
    setLoading(true)
    try {
      const client = getClient()
      const result = await client.getSession()

      if (result.data?.user) {
        setIsEnabled((result.data.user as { twoFactorEnabled?: boolean }).twoFactorEnabled ?? false)
      } else {
        setIsEnabled(false)
      }
    } catch {
      setError('Failed to check 2FA status')
    } finally {
      setLoading(false)
    }
  }

  function handleEnableClick() {
    // Show password prompt first
    setStep('password')
    setPassword('')
    setError(null)
  }

  async function handleEnableWithPassword(e: FormEvent) {
    e.preventDefault()
    setActionLoading(true)
    setError(null)

    try {
      const client = getClient()
      const result = await client.twoFactor.enable({ password })

      if (result.error) {
        setError(result.error.message ?? 'Failed to enable 2FA')
      } else if (result.data) {
        setTotpUri(result.data.totpURI)
        // Secret is embedded in the totpURI, extract it for manual entry option
        const secretMatch = result.data.totpURI.match(/secret=([A-Z2-7]+)/i)
        setSecret(secretMatch ? secretMatch[1] : null)
        setBackupCodes(result.data.backupCodes ?? [])
        setPassword('') // Clear password
        setStep('setup')
      }
    } catch {
      setError('Failed to enable 2FA')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleVerify(e: FormEvent) {
    e.preventDefault()
    setActionLoading(true)
    setError(null)

    try {
      const client = getClient()
      const result = await client.twoFactor.verifyTotp({ code: verificationCode })

      if (result.error) {
        setError(result.error.message ?? 'Invalid verification code')
      } else {
        if (backupCodes.length > 0) {
          setStep('backup')
        } else {
          setIsEnabled(true)
          setStep('status')
        }
      }
    } catch {
      setError('Verification failed')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleDisable() {
    if (!confirm('Are you sure you want to disable two-factor authentication?')) {
      return
    }

    setActionLoading(true)
    setError(null)

    try {
      const client = getClient()
      const result = await client.twoFactor.disable({ password: '' })

      if (result.error) {
        setError(result.error.message ?? 'Failed to disable 2FA')
      } else {
        setIsEnabled(false)
      }
    } catch {
      setError('Failed to disable 2FA')
    } finally {
      setActionLoading(false)
    }
  }

  function handleBackupContinue() {
    setIsEnabled(true)
    setStep('status')
  }

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 'calc(var(--base) * 3)',
        }}
      >
        <div style={{ color: 'var(--theme-text)', opacity: 0.7 }}>
          Loading...
        </div>
      </div>
    )
  }

  return (
    <div
      style={{
        maxWidth: '600px',
        margin: '0 auto',
        padding: 'calc(var(--base) * 2)',
      }}
    >

        <h1
          style={{
            color: 'var(--theme-text)',
            fontSize: 'var(--font-size-h2)',
            fontWeight: 600,
            margin: '0 0 calc(var(--base) * 2) 0',
          }}
        >
          {title}
        </h1>

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

        {step === 'status' && (
          <div
            style={{
              background: 'var(--theme-elevation-50)',
              padding: 'calc(var(--base) * 1.5)',
              borderRadius: 'var(--style-radius-m)',
              border: '1px solid var(--theme-elevation-100)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
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
                  Status
                </div>
                <div
                  style={{
                    color: isEnabled
                      ? 'var(--theme-success-500)'
                      : 'var(--theme-elevation-600)',
                    fontSize: 'var(--font-size-small)',
                  }}
                >
                  {isEnabled ? '✓ Enabled' : 'Not enabled'}
                </div>
              </div>

              <button
                onClick={isEnabled ? handleDisable : handleEnableClick}
                disabled={actionLoading}
                style={{
                  padding: 'calc(var(--base) * 0.5) calc(var(--base) * 1)',
                  background: isEnabled
                    ? 'var(--theme-error-500)'
                    : 'var(--theme-elevation-800)',
                  border: 'none',
                  borderRadius: 'var(--style-radius-s)',
                  color: 'var(--theme-elevation-50)',
                  fontSize: 'var(--font-size-small)',
                  cursor: actionLoading ? 'not-allowed' : 'pointer',
                  opacity: actionLoading ? 0.7 : 1,
                }}
              >
                {actionLoading
                  ? 'Loading...'
                  : isEnabled
                    ? 'Disable'
                    : 'Enable'}
              </button>
            </div>
          </div>
        )}

        {step === 'password' && (
          <div
            style={{
              background: 'var(--theme-elevation-50)',
              padding: 'calc(var(--base) * 2)',
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
              Confirm Your Password
            </h2>
            <p
              style={{
                color: 'var(--theme-text)',
                opacity: 0.7,
                fontSize: 'var(--font-size-small)',
                marginBottom: 'calc(var(--base) * 1.5)',
              }}
            >
              Enter your password to enable two-factor authentication.
            </p>
            <form onSubmit={handleEnableWithPassword}>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                style={{
                  width: '100%',
                  padding: 'calc(var(--base) * 0.75)',
                  background: 'var(--theme-input-bg)',
                  border: '1px solid var(--theme-elevation-150)',
                  borderRadius: 'var(--style-radius-s)',
                  color: 'var(--theme-text)',
                  fontSize: 'var(--font-size-base)',
                  marginBottom: 'var(--base)',
                  boxSizing: 'border-box',
                }}
              />
              <div style={{ display: 'flex', gap: 'calc(var(--base) * 0.5)' }}>
                <button
                  type="submit"
                  disabled={actionLoading || !password}
                  style={{
                    padding: 'calc(var(--base) * 0.75) calc(var(--base) * 1.5)',
                    background: 'var(--theme-elevation-800)',
                    border: 'none',
                    borderRadius: 'var(--style-radius-s)',
                    color: 'var(--theme-elevation-50)',
                    fontSize: 'var(--font-size-base)',
                    cursor: actionLoading || !password ? 'not-allowed' : 'pointer',
                    opacity: actionLoading || !password ? 0.7 : 1,
                  }}
                >
                  {actionLoading ? 'Enabling...' : 'Continue'}
                </button>
                <button
                  type="button"
                  onClick={() => setStep('status')}
                  style={{
                    padding: 'calc(var(--base) * 0.75) calc(var(--base) * 1.5)',
                    background: 'transparent',
                    border: '1px solid var(--theme-elevation-200)',
                    borderRadius: 'var(--style-radius-s)',
                    color: 'var(--theme-text)',
                    fontSize: 'var(--font-size-base)',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {step === 'setup' && totpUri && (
          <div
            style={{
              background: 'var(--theme-elevation-50)',
              padding: 'calc(var(--base) * 2)',
              borderRadius: 'var(--style-radius-m)',
              textAlign: 'center',
            }}
          >
            <p
              style={{
                color: 'var(--theme-text)',
                opacity: 0.7,
                marginBottom: 'calc(var(--base) * 1.5)',
              }}
            >
              Scan this QR code with your authenticator app:
            </p>

            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(totpUri)}`}
              alt="QR Code"
              style={{
                width: '200px',
                height: '200px',
                border: '1px solid var(--theme-elevation-150)',
                borderRadius: 'var(--style-radius-s)',
                marginBottom: 'var(--base)',
              }}
            />

            {secret && (
              <div style={{ marginBottom: 'calc(var(--base) * 1.5)' }}>
                <p
                  style={{
                    color: 'var(--theme-text)',
                    opacity: 0.7,
                    fontSize: 'var(--font-size-small)',
                    marginBottom: 'calc(var(--base) * 0.5)',
                  }}
                >
                  Or enter manually:
                </p>
                <code
                  style={{
                    display: 'inline-block',
                    padding: 'calc(var(--base) * 0.5)',
                    background: 'var(--theme-elevation-100)',
                    borderRadius: 'var(--style-radius-s)',
                    fontFamily: 'monospace',
                    fontSize: 'var(--font-size-small)',
                    color: 'var(--theme-text)',
                  }}
                >
                  {secret}
                </code>
              </div>
            )}

            <form onSubmit={handleVerify}>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={verificationCode}
                onChange={(e) =>
                  setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))
                }
                placeholder="Enter 6-digit code"
                style={{
                  width: '100%',
                  maxWidth: '200px',
                  padding: 'calc(var(--base) * 0.75)',
                  background: 'var(--theme-input-bg)',
                  border: '1px solid var(--theme-elevation-150)',
                  borderRadius: 'var(--style-radius-s)',
                  color: 'var(--theme-text)',
                  fontSize: 'var(--font-size-h4)',
                  fontFamily: 'monospace',
                  textAlign: 'center',
                  letterSpacing: '0.5em',
                  marginBottom: 'var(--base)',
                  boxSizing: 'border-box',
                }}
              />
              <br />
              <button
                type="submit"
                disabled={actionLoading || verificationCode.length !== 6}
                style={{
                  padding: 'calc(var(--base) * 0.75) calc(var(--base) * 2)',
                  background: 'var(--theme-elevation-800)',
                  border: 'none',
                  borderRadius: 'var(--style-radius-s)',
                  color: 'var(--theme-elevation-50)',
                  fontSize: 'var(--font-size-base)',
                  cursor:
                    actionLoading || verificationCode.length !== 6
                      ? 'not-allowed'
                      : 'pointer',
                  opacity:
                    actionLoading || verificationCode.length !== 6 ? 0.7 : 1,
                }}
              >
                {actionLoading ? 'Verifying...' : 'Verify'}
              </button>
            </form>
          </div>
        )}

        {step === 'backup' && (
          <div
            style={{
              background: 'var(--theme-elevation-50)',
              padding: 'calc(var(--base) * 2)',
              borderRadius: 'var(--style-radius-m)',
            }}
          >
            <h2
              style={{
                color: 'var(--theme-text)',
                fontSize: 'var(--font-size-h3)',
                fontWeight: 600,
                margin: '0 0 var(--base) 0',
                textAlign: 'center',
              }}
            >
              Save Your Backup Codes
            </h2>
            <p
              style={{
                color: 'var(--theme-text)',
                opacity: 0.7,
                fontSize: 'var(--font-size-small)',
                textAlign: 'center',
                marginBottom: 'calc(var(--base) * 1.5)',
              }}
            >
              Store these codes safely. Use them if you lose your authenticator.
            </p>

            <div
              style={{
                background: 'var(--theme-elevation-100)',
                padding: 'var(--base)',
                borderRadius: 'var(--style-radius-s)',
                marginBottom: 'var(--base)',
                fontFamily: 'monospace',
              }}
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: 'calc(var(--base) * 0.5)',
                }}
              >
                {backupCodes.map((code, index) => (
                  <div
                    key={index}
                    style={{
                      color: 'var(--theme-text)',
                      padding: 'calc(var(--base) * 0.25)',
                    }}
                  >
                    {code}
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={() => navigator.clipboard.writeText(backupCodes.join('\n'))}
              style={{
                width: '100%',
                padding: 'calc(var(--base) * 0.5)',
                background: 'var(--theme-elevation-150)',
                border: 'none',
                borderRadius: 'var(--style-radius-s)',
                color: 'var(--theme-text)',
                fontSize: 'var(--font-size-small)',
                cursor: 'pointer',
                marginBottom: 'var(--base)',
              }}
            >
              Copy to Clipboard
            </button>

            <button
              onClick={handleBackupContinue}
              style={{
                width: '100%',
                padding: 'calc(var(--base) * 0.75)',
                background: 'var(--theme-elevation-800)',
                border: 'none',
                borderRadius: 'var(--style-radius-s)',
                color: 'var(--theme-elevation-50)',
                fontSize: 'var(--font-size-base)',
                cursor: 'pointer',
              }}
            >
              I've Saved My Codes
            </button>
          </div>
        )}
    </div>
  )
}

export default TwoFactorManagementClient
