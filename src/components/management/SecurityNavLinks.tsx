'use client'

export type SecurityNavLinksProps = {
  /** Base path for security views. Default: '/admin/security' */
  basePath?: string
  /** Show Two-Factor Auth link. Default: true */
  showTwoFactor?: boolean
  /** Show API Keys link. Default: true */
  showApiKeys?: boolean
  /** Show Passkeys link. Default: true */
  showPasskeys?: boolean
}

type NavLink = {
  href: string
  label: string
  icon: string
}

/**
 * Navigation links for security management features.
 * Rendered in admin sidebar via afterNavLinks injection.
 * Uses Payload's nav CSS classes for native styling.
 *
 * Links are conditionally shown based on which Better Auth plugins are enabled.
 */
export function SecurityNavLinks({
  basePath = '/admin/security',
  showTwoFactor = true,
  showApiKeys = true,
  showPasskeys = true,
}: SecurityNavLinksProps = {}) {
  // Build links based on enabled plugins
  const links: NavLink[] = []

  if (showTwoFactor) {
    links.push({
      href: `${basePath}/two-factor`,
      label: 'Two-Factor Auth',
      icon: '📱',
    })
  }

  if (showApiKeys) {
    links.push({
      href: `${basePath}/api-keys`,
      label: 'API Keys',
      icon: '🔑',
    })
  }

  if (showPasskeys) {
    links.push({
      href: `${basePath}/passkeys`,
      label: 'Passkeys',
      icon: '🔐',
    })
  }

  // Don't render anything if no plugins are enabled
  if (links.length === 0) {
    return null
  }

  return (
    <div
      style={{
        borderTop: '1px solid var(--theme-elevation-100)',
        marginTop: 'var(--base)',
        paddingTop: 'var(--base)',
      }}
    >
      <div
        style={{
          fontSize: '11px',
          fontWeight: 600,
          color: 'var(--theme-elevation-500)',
          padding: '0 calc(var(--base) * 0.75)',
          marginBottom: 'calc(var(--base) * 0.5)',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}
      >
        Security
      </div>
      {links.map((link) => (
        <a
          key={link.href}
          href={link.href}
          className="nav__link"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'calc(var(--base) * 0.5)',
            padding: 'calc(var(--base) * 0.5) calc(var(--base) * 0.75)',
            color: 'var(--theme-elevation-800)',
            textDecoration: 'none',
            fontSize: 'var(--font-size-small)',
            borderRadius: 'var(--style-radius-s)',
            transition: 'background-color 150ms ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--theme-elevation-50)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent'
          }}
        >
          <span style={{ fontSize: '14px' }}>{link.icon}</span>
          <span className="nav__link-label">{link.label}</span>
        </a>
      ))}
    </div>
  )
}

export default SecurityNavLinks
