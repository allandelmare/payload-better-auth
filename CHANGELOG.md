# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-01-11

### Added

#### Automatic Auth API Endpoints

The plugin now auto-registers `/api/auth/*` endpoints via Payload's endpoint system, eliminating the need to manually create an `app/api/auth/[...all]/route.ts` file.

- Endpoints are registered for GET, POST, PATCH, PUT, DELETE methods
- Requests are proxied to Better Auth's handler
- Configurable via `authBasePath` option (default: `/auth`)
- Can be disabled with `autoRegisterEndpoints: false` for advanced use cases

#### Automatic Admin Components

When `disableLocalStrategy: true` is detected in your Users collection, the plugin automatically injects admin components:

- **LogoutButton**: Styled to match Payload's admin nav using CSS variables
- **BeforeLogin**: Redirects to `/admin/login` for custom authentication
- **LoginView**: Full login page matching Payload's admin theme (light/dark mode)

All components use Payload's CSS variables for native theme integration.

#### Plugin Configuration Options

New options for `createBetterAuthPlugin()`:

```typescript
createBetterAuthPlugin({
  createAuth,
  authBasePath: '/auth',              // Customize auth endpoint path
  autoRegisterEndpoints: true,        // Auto-register API endpoints
  autoInjectAdminComponents: true,    // Auto-inject admin components
  admin: {
    disableLogoutButton: false,       // Disable logout button injection
    disableBeforeLogin: false,        // Disable BeforeLogin injection
    disableLoginView: false,          // Disable login view injection
    login: {
      title: 'Login',                 // Customize login page title
      afterLoginPath: '/admin',       // Redirect after successful login
    },
    // Override with custom components (import map format)
    logoutButtonComponent: '@/components/MyLogout',
    beforeLoginComponent: '@/components/MyBeforeLogin',
    loginViewComponent: '@/components/MyLoginView',
  },
})
```

#### New Export: Components

Admin components are now available for direct use or customization:

```typescript
import { LogoutButton, BeforeLogin, LoginView } from '@delmaredigital/payload-better-auth/components'
```

#### New Export: detectAuthConfig

Utility function to detect auth configuration in Payload config:

```typescript
import { detectAuthConfig } from '@delmaredigital/payload-better-auth'

const result = detectAuthConfig(config)
// { hasDisableLocalStrategy: boolean, authCollectionSlug: string | null, ... }
```

### Changed

- `BetterAuthPluginOptions` expanded with new configuration options
- README simplified with reduced setup steps (7 steps → 4 steps)
- Plugin now scans collections to detect `disableLocalStrategy` configuration

### Migration from 0.1.x

If upgrading from 0.1.x, you can simplify your setup:

1. **Remove manual API route** - Delete `app/api/auth/[...all]/route.ts`
2. **Remove manual admin components** - Delete custom BeforeLogin, Logout, and login page components
3. **Remove admin.components configuration** - Remove from payload.config.ts

The plugin now handles all of the above automatically when `disableLocalStrategy: true` is detected.

**To keep your existing manual setup**, disable auto-injection:

```typescript
createBetterAuthPlugin({
  createAuth,
  autoRegisterEndpoints: false,
  autoInjectAdminComponents: false,
})
```

---

## [0.1.5] - 2026-01-10

### Changed

- Switch license to MIT

---

## [0.1.4] - 2026-01-09

### Fixed

- Initial stable release
- Payload adapter for Better Auth
- Collection auto-generation from Better Auth schema
- Auth strategy for Payload collections
- Session utilities for server-side access
