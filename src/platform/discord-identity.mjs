import crypto from 'node:crypto';
import { getTenantProfile } from './tenants.mjs';

/** Module-private seals — never Symbol.for; other modules cannot mint these. */
const VERIFIED_ACTOR = Symbol('pixenetwork.discord.verifiedActor');
const VERIFIED_TOOL = Symbol('pixenetwork.discord.verifiedToolConfirmation');

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

function iso(value = Date.now()) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error('A valid timestamp is required');
  return date.toISOString();
}

/**
 * Fixture / test Discord-identity binder for domain-layer unit tests.
 *
 * IMPORTANT: bindMember trusts caller-supplied member/role IDs and does NOT call Discord.
 * It is not production write-enable. Production must use a Discord client adapter that
 * reads real guild member role IDs from the Discord API / gateway before sealing actors.
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

    /**
     * Test/fixture bind only. Does not fetch Discord members or roles.
     */
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
     * Requires ticketId bind, single-use nonce, and createdAt.
     * Caller-supplied confirmation bags without this seal are rejected by engines.
     */
    confirmToolResult(input) {
      const toolName = String(input?.toolName ?? '').trim();
      const confirmationId = String(input?.confirmationId ?? '').trim();
      const ticketId = String(input?.ticketId ?? '').trim();
      const nonce = String(input?.nonce ?? crypto.randomUUID()).trim();
      if (!toolName || !confirmationId) {
        throw new Error('toolName and confirmationId are required for verified tool confirmation');
      }
      if (!ticketId) throw new Error('ticketId is required to bind a verified tool confirmation');
      if (!nonce) throw new Error('nonce is required for verified tool confirmation');
      const createdAt = iso(input?.createdAt ?? Date.now());
      return Object.freeze({
        [VERIFIED_TOOL]: true,
        toolName,
        confirmationId,
        ticketId,
        nonce,
        createdAt,
        result: String(input?.result ?? '').trim() || null,
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
