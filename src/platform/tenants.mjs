import { defaultModuleState, fullSuiteModuleState, validateModuleState } from './modules.mjs';

const profile = (key, name, scope, options = {}) => Object.freeze({
  key,
  name,
  scope,
  sensitive: options.sensitive !== false,
  allowFormerStaff: Boolean(options.allowFormerStaff),
  modules: validateModuleState(options.modules ?? defaultModuleState()),
});

export const TENANT_PROFILES = Object.freeze({
  beverly_hills_rp: profile(
    'beverly_hills_rp',
    'Beverly Hills RP',
    'fivem-server',
    { modules: fullSuiteModuleState() },
  ),
  blood_diamond_rp: profile(
    'blood_diamond_rp',
    'Blood Diamond RP',
    'fivem-server',
    { modules: fullSuiteModuleState() },
  ),
  pixel_network_office: profile(
    'pixel_network_office',
    'Pixel Network Office',
    'social',
    {
      sensitive: false,
      allowFormerStaff: true,
      modules: {
        ...defaultModuleState(),
        welcome: true,
        polls: true,
        translation: true,
        booster_responder: true,
        sticky_messages: true,
        keyword_responses: true,
        ai_budget: true,
      },
    },
  ),
  customer_support: profile(
    'customer_support',
    'Pixel Network Customer Support',
    'product-support',
    {
      modules: {
        ...defaultModuleState(),
        tickets: true,
        ticket_panels: true,
        ticket_claiming: true,
        ticket_transcripts: true,
        retention: true,
        tebex_verification: true,
        tebex_fraud_flags: true,
        tebex_tickets: true,
        ai_budget: true,
        ai_ticket_agent: true,
        knowledge_base: true,
        known_issue_detection: true,
        customer_script_support: true,
        license_entitlements: true,
        github_handoff: true,
      },
    },
  ),
});

export function getTenantProfile(key) {
  const tenant = TENANT_PROFILES[String(key)];
  if (!tenant) throw new Error(`Unknown Discord tenant: ${key}`);
  return tenant;
}

export function assertTenantModuleEnabled(tenantKey, moduleKey) {
  const tenant = getTenantProfile(tenantKey);
  const key = String(moduleKey ?? '');
  if (!key || !Object.hasOwn(tenant.modules, key)) throw new Error(`Unknown Discord module: ${moduleKey}`);
  if (!tenant.modules[key]) throw new Error(`Module ${key} is disabled for tenant ${tenantKey}`);
  return true;
}

export function assertTenantBoundary({ actorTenant, targetTenant, actorIsOwner = false }) {
  const actor = getTenantProfile(actorTenant);
  const target = getTenantProfile(targetTenant);
  if (actor.key === target.key) return true;
  if (actorIsOwner) return true;
  throw new Error(`Cross-tenant access denied: ${actor.key} -> ${target.key}`);
}

export function canFormerStaffAccess(tenantKey) {
  return getTenantProfile(tenantKey).allowFormerStaff;
}
