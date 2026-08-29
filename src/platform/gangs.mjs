import { requireVerifiedActor } from './discord-identity.mjs';
import { assertTenantBoundary, assertTenantModuleEnabled, getTenantProfile } from './tenants.mjs';

const DEFAULT_ACTION_ROLES = Object.freeze({
  gang_manage: Object.freeze(['staff']),
  gang_strike: Object.freeze(['staff']),
  priority_manage: Object.freeze(['staff']),
});

function iso(value = Date.now()) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error('A valid timestamp is required');
  return date.toISOString();
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function actor(input) {
  return requireVerifiedActor(input, 'gang actor');
}

function rolePolicy(authorization, tenantId, action) {
  const config = authorization?.[tenantId];
  if (!config?.canonicalRoleIds) throw new Error(`Missing canonical role configuration for tenant ${tenantId}`);
  const aliases = (config.actionRoles ?? DEFAULT_ACTION_ROLES)[action];
  if (!Array.isArray(aliases) || !aliases.length) throw new Error(`Missing role policy for ${action} in tenant ${tenantId}`);
  const ids = aliases.map((name) => config.canonicalRoleIds[name]).filter(Boolean).map(String);
  if (!ids.length) throw new Error(`Missing canonical role IDs for ${action} in tenant ${tenantId}`);
  return ids;
}

function authorize(authorization, who, action) {
  const allowed = rolePolicy(authorization, who.tenantId, action);
  if (!allowed.some((id) => who.roleIds.includes(id))) throw new Error(`Authorization denied for ${action} in tenant ${who.tenantId}`);
}

function gangKey(tenantId, gangId) {
  return `${tenantId}:${gangId}`;
}

function normalizeGangId(value) {
  const id = String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
  if (!id) throw new Error('gangId is required');
  return id;
}

function ensureSameTenant(who, gang) {
  assertTenantBoundary({ actorTenant: who.tenantId, targetTenant: gang.tenantId, actorIsOwner: false });
}

function history(gang, type, who, details = {}, now) {
  gang.history.push({ tenantId: gang.tenantId, gangId: gang.id, type, actorId: who.userId, createdAt: iso(now), ...details });
}

export class GangEngine {
  constructor(options = {}) {
    this.authorization = options.authorization ?? {};
    this.priorityTiers = Object.freeze({ ...(options.priorityTiers ?? {
      none: { rank: 0, roleId: null },
      bronze: { rank: 10, roleId: null },
      silver: { rank: 20, roleId: null },
      gold: { rank: 30, roleId: null },
      diamond: { rank: 40, roleId: null },
    }) });
    this.gangs = new Map();
    this.strikeCounter = 1;
  }

  createGang(input) {
    const who = actor(input?.actor);
    assertTenantModuleEnabled(who.tenantId, 'gang_manager');
    authorize(this.authorization, who, 'gang_manage');
    const id = normalizeGangId(input?.gangId ?? input?.name);
    const key = gangKey(who.tenantId, id);
    if (this.gangs.has(key)) throw new Error(`Gang ${id} already exists in tenant ${who.tenantId}`);
    const ownerId = String(input?.ownerId ?? '').trim();
    if (!ownerId) throw new Error('ownerId is required');
    const createdAt = iso(input?.now);
    const record = {
      id,
      tenantId: who.tenantId,
      name: String(input?.name ?? id).trim(),
      ownerId,
      memberIds: [ownerId],
      purchasedSlots: Number.isInteger(input?.purchasedSlots) && input.purchasedSlots > 0 ? input.purchasedSlots : 1,
      priorityTier: 'none',
      activeStrikeIds: [],
      strikes: [],
      createdAt,
      updatedAt: createdAt,
      history: [],
    };
    history(record, 'gang_created', who, { ownerId }, input?.now);
    this.gangs.set(key, record);
    return clone(record);
  }

  getGang(tenantId, gangId) {
    getTenantProfile(String(tenantId));
    const id = normalizeGangId(gangId);
    const record = this.gangs.get(gangKey(String(tenantId), id));
    if (!record) throw new Error(`Unknown gang ${id} in tenant ${tenantId}`);
    return clone(record);
  }

  addMember(input) {
    const who = actor(input?.actor);
    const gang = this.#mutable(who, input?.gangId, 'gang_manage', 'gang_manager');
    const memberId = String(input?.memberId ?? '').trim();
    if (!memberId) throw new Error('memberId is required');
    if (gang.memberIds.includes(memberId)) return clone(gang);
    if (gang.memberIds.length >= gang.purchasedSlots) throw new Error(`Gang ${gang.id} has reached its purchased slot limit (${gang.purchasedSlots})`);
    gang.memberIds.push(memberId);
    gang.updatedAt = iso(input?.now);
    history(gang, 'gang_member_added', who, { memberId }, input?.now);
    return clone(gang);
  }

  removeMember(input) {
    const who = actor(input?.actor);
    const gang = this.#mutable(who, input?.gangId, 'gang_manage', 'gang_manager');
    const memberId = String(input?.memberId ?? '').trim();
    if (memberId === gang.ownerId) throw new Error('Transfer ownership before removing the gang owner');
    gang.memberIds = gang.memberIds.filter((id) => id !== memberId);
    gang.updatedAt = iso(input?.now);
    history(gang, 'gang_member_removed', who, { memberId }, input?.now);
    return clone(gang);
  }

  transferOwner(input) {
    const who = actor(input?.actor);
    const gang = this.#mutable(who, input?.gangId, 'gang_manage', 'gang_manager');
    const ownerId = String(input?.ownerId ?? '').trim();
    if (!gang.memberIds.includes(ownerId)) throw new Error('New gang owner must already be a gang member');
    const previousOwnerId = gang.ownerId;
    gang.ownerId = ownerId;
    gang.updatedAt = iso(input?.now);
    history(gang, 'gang_owner_transferred', who, { previousOwnerId, ownerId }, input?.now);
    return clone(gang);
  }

  setPurchasedSlots(input) {
    const who = actor(input?.actor);
    const gang = this.#mutable(who, input?.gangId, 'priority_manage', 'queue_priority');
    const slots = Number(input?.slots);
    if (!Number.isInteger(slots) || slots < 1) throw new Error('Purchased slots must be a positive integer');
    if (slots < gang.memberIds.length) throw new Error('Purchased slots cannot be lower than current membership');
    gang.purchasedSlots = slots;
    gang.updatedAt = iso(input?.now);
    history(gang, 'gang_slots_changed', who, { slots }, input?.now);
    return clone(gang);
  }

  setPriorityTier(input) {
    const who = actor(input?.actor);
    const gang = this.#mutable(who, input?.gangId, 'priority_manage', 'queue_priority');
    const tier = String(input?.tier ?? '').trim().toLowerCase();
    if (!Object.hasOwn(this.priorityTiers, tier)) throw new Error(`Unknown priority tier: ${tier}`);
    const previousTier = gang.priorityTier;
    gang.priorityTier = tier;
    gang.updatedAt = iso(input?.now);
    history(gang, 'gang_priority_changed', who, { previousTier, tier }, input?.now);
    return clone(gang);
  }

  addStrike(input) {
    const who = actor(input?.actor);
    const gang = this.#mutable(who, input?.gangId, 'gang_strike', 'gang_strikes');
    const reason = String(input?.reason ?? '').trim();
    if (!reason) throw new Error('Strike reason is required');
    const strike = {
      id: `strike_${this.strikeCounter++}`,
      tenantId: gang.tenantId,
      gangId: gang.id,
      reason,
      points: Number.isInteger(input?.points) && input.points > 0 ? input.points : 1,
      createdBy: who.userId,
      createdAt: iso(input?.now),
      resolvedAt: null,
      resolvedBy: null,
      resolution: null,
    };
    gang.strikes.push(strike);
    gang.activeStrikeIds.push(strike.id);
    gang.updatedAt = strike.createdAt;
    history(gang, 'gang_strike_added', who, { strikeId: strike.id, points: strike.points }, input?.now);
    return clone(strike);
  }

  resolveStrike(input) {
    const who = actor(input?.actor);
    const gang = this.#mutable(who, input?.gangId, 'gang_strike', 'gang_strikes');
    const strike = gang.strikes.find((entry) => entry.id === String(input?.strikeId));
    if (!strike) throw new Error(`Unknown strike: ${input?.strikeId}`);
    if (strike.resolvedAt) return clone(strike);
    strike.resolvedAt = iso(input?.now);
    strike.resolvedBy = who.userId;
    strike.resolution = String(input?.resolution ?? '').trim() || null;
    gang.activeStrikeIds = gang.activeStrikeIds.filter((id) => id !== strike.id);
    gang.updatedAt = strike.resolvedAt;
    history(gang, 'gang_strike_resolved', who, { strikeId: strike.id }, input?.now);
    return clone(strike);
  }

  roleSyncPlan(tenantId, gangId) {
    assertTenantModuleEnabled(tenantId, 'queue_priority');
    const gang = this.getGang(tenantId, gangId);
    const tier = this.priorityTiers[gang.priorityTier];
    return Object.freeze({
      tenantId: gang.tenantId,
      gangId: gang.id,
      priorityTier: gang.priorityTier,
      priorityRank: tier.rank,
      priorityRoleId: tier.roleId ? String(tier.roleId) : null,
      memberIds: Object.freeze([...gang.memberIds]),
    });
  }

  #mutable(who, gangId, action, moduleKey) {
    assertTenantModuleEnabled(who.tenantId, moduleKey);
    authorize(this.authorization, who, action);
    const id = normalizeGangId(gangId);
    const gang = this.gangs.get(gangKey(who.tenantId, id));
    if (!gang) {
      for (const candidate of this.gangs.values()) {
        if (candidate.id === id) ensureSameTenant(who, candidate);
      }
      throw new Error(`Unknown gang ${id} in tenant ${who.tenantId}`);
    }
    ensureSameTenant(who, gang);
    return gang;
  }
}

export function createGangEngine(options) {
  return new GangEngine(options);
}

export { DEFAULT_ACTION_ROLES };
