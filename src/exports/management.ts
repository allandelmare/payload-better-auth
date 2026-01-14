/**
 * Management UI Components Export
 *
 * Client components for managing security features in the Payload admin panel.
 * For server component views, use the './rsc' export.
 */

// Client components
export {
  SecurityNavLinks,
  TwoFactorManagementClient,
  ApiKeysManagementClient,
  PasskeysManagementClient,
} from '../components/management/index.js'

export type {
  SecurityNavLinksProps,
  TwoFactorManagementClientProps,
  ApiKeysManagementClientProps,
  PasskeysManagementClientProps,
} from '../components/management/index.js'

// Re-export plugin detection utility
export { detectEnabledPlugins } from '../utils/detectEnabledPlugins.js'
export type { EnabledPluginsResult } from '../utils/detectEnabledPlugins.js'
