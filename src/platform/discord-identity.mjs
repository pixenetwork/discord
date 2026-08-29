import { getTenantProfile } from './tenants.mjs';

const VERIFIED_ACTOR = Symbol.for('pixenetwork.discord.verifiedActor');
const VERIFIED_TOOL = Symbol.for('pixenetwork.discord.verifiedToolConfirmation');

function freezeActor(userId, tenantId, roleIds) {
  return Object.freeze({
    [VERIFIED_ACTOR]: true,
    userId: String(userId),
    tenantId: String(tenantId),
    roleIds: Object.freeze([...new Set(roleIds.map(String).filter(Boolean))]),
  });
}

function extractRoleIds(member) {
  if (Array.isArray(member?.roleIds)) return member.roleIds.map(String);
  if (Array.isArray(member?.roles)) return member.roles.map((role) => String(role?.id ?? role));
  const cache = member?.roles?.cache;
  if (cache && typeof cache.keys === 'function') return [...cache.keys()].map(String);
  if (cache && typeof cache === 'object') return Object.keys(cache).map(String);
  return [];
}

/**
 * Binds Discord guild membership into a sealed actor engines will accept.
 * Does not perform live Discord API calls — callers pass already-fetched member fixtures
 * (or live member objects from the Discord client layer outside this domain).
 */
export function createDiscordIdentityAdapter(options = {}) {
  const guildTenantMap = Object.freeze({ ...(options.guildTenantMap ?? {}) });

  function resolveTenantId(guildId) {
    const mapped = guildTenantMap[String(guildId)];
    if (!mapped) throw new Error(`No tenant mapping for Discord guild ${guildId}`);
    return getTenantProfile(mapped).key;
  }

  return Object.freeze({
    guildTenantMap,

    bindMember(input) {
      const guildId = String(input?.guildId ?? '').trim();
      const member = input?.member;
      const userId = String(member?.id ?? member?.userId ?? member?.user?.id ?? '').trim();
      if (!guildId) throw new Error('guildId is required to bind Discord identity');
      if (!userId) throw new Error('Discord member id is required');
      const tenantId = resolveTenantId(guildId);
      return freezeActor(userId, tenantId, extractRoleIds(member));
    },

    /**
     * Seal a tool result after an external adapter confirms the tool ran.
     * Caller-supplied confirmation bags without this seal are rejected by engines.
     */
    confirmToolResult(input) {
      const toolName = String(input?.toolName ?? '').trim();
      const confirmationId = String(input?.confirmationId ?? '').trim();
      if (!toolName || !confirmationId) {
        throw new Error('toolName and confirmationId are required for verified tool confirmation');
      }
      return Object.freeze({
        [VERIFIED_TOOL]: true,
        toolName,
        confirmationId,
        result: String(input?.result ?? '').trim() || null,
        confirmedAt: input?.confirmedAt ? new Date(input.confirmedAt).toISOString() : null,
      });
    },
  });
}

export function isVerifiedActor(value) {
  return Boolean(value && value[VERIFIED_ACTOR] === true);
}

export function requireVerifiedActor(value, label = 'actor') {
  if (!isVerifiedActor(value)) {
    throw new Error(`Unverified Discord identity: ${label} must be bound via Discord identity adapter`);
  }
  getTenantProfile(value.tenantId);
  return value;
}

export function isVerifiedToolConfirmation(value) {
  return Boolean(value && value[VERIFIED_TOOL] === true);
}

export function requireVerifiedToolConfirmation(value) {
  if (!isVerifiedToolConfirmation(value)) {
    throw new Error('Unverified tool confirmation: must be sealed by the Discord identity adapter');
  }
  return value;
}

export { VERIFIED_ACTOR, VERIFIED_TOOL };
