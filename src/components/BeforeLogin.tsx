'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation.js'

export type BeforeLoginProps = {
  /** URL to redirect to for login. Default: '/admin/login' */
  loginUrl?: string
}

/**
 * BeforeLogin component that redirects to the custom login page.
 * Injected into Payload's beforeLogin slot to intercept default login.
 */
export function BeforeLogin({ loginUrl = '/admin/login' }: BeforeLoginProps) {
  const router = useRouter()

  useEffect(() => {
    router.replace(loginUrl)
  }, [router, loginUrl])

  // Show loading state while redirecting
  return (
    <div
      style={{
        display: 'flex',
        minHeight: '100vh',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--theme-bg)',
        color: 'var(--theme-text)',
      }}
    >
      <div>Redirecting to login...</div>
    </div>
  )
}

export default BeforeLogin
