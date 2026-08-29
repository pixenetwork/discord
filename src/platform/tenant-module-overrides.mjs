/**
 * Process-local tenant module override map for explicit ops/test tooling.
 * Not reachable over HTTP. Do not import from index, webhook-handler, commands, or gpt.
 */
const tenantModuleOverrides = new Map();

export function peekTenantModuleOverride(tenantKey) {
  return tenantModuleOverrides.get(String(tenantKey)) ?? null;
}

export function setTenantModuleOverride(tenantKey, modules) {
  tenantModuleOverrides.set(String(tenantKey), modules);
  return modules;
}

export function clearTenantModuleOverrides(tenantKey) {
  if (tenantKey == null) {
    tenantModuleOverrides.clear();
    return;
  }
  tenantModuleOverrides.delete(String(tenantKey));
}
