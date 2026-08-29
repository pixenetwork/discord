import { enableModule, getTenantModules, getTenantProfile } from '../../src/platform/tenants.mjs';
import {
  clearTenantModuleOverrides,
  setTenantModuleOverride,
} from '../../src/platform/tenant-module-overrides.mjs';

/**
 * Test-only tenant module flip helpers.
 * Not a public Discord/HTTP command. Production worker/HTTP paths must not import this file
 * or enableTenantModule / clearTenantModuleOverrides / setTenantModuleOverride.
 */
export function enableTenantModule(tenantKey, moduleKey) {
  getTenantProfile(tenantKey);
  const next = enableModule({ ...getTenantModules(tenantKey) }, moduleKey);
  return setTenantModuleOverride(tenantKey, next);
}

export { clearTenantModuleOverrides };
