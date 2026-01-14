'use client'

export type SecurityNavLinksProps = {
  /** Base path for security views. Default: '/admin/security' */
  basePath?: string
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
 * Note: All security links are shown. Views that are not enabled
 * will display an appropriate message when accessed.
 */
export function SecurityNavLinks({
  basePath = '/admin/security',
}: SecurityNavLinksProps = {}) {
  // Show security management views
  const links: NavLink[] = [
    {
      href: `${basePath}/two-factor`,
      label: 'Two-Factor Auth',
      icon: '📱',
    },
    {
      href: `${basePath}/api-keys`,
      label: 'API Keys',
      icon: '🔑',
    },
    {
      href: `${basePath}/passkeys`,
      label: 'Passkeys',
      icon: '🔐',
    },
  ]

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
