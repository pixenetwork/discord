import { requireVerifiedActor } from './discord-identity.mjs';
import { assertTenantModuleEnabled, getTenantProfile } from './tenants.mjs';

function iso(value = Date.now()) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error('A valid timestamp is required');
  return date.toISOString();
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function actor(input) {
  return requireVerifiedActor(input, 'handoff actor');
}

function authorize(authorization, who) {
  const canonical = authorization?.[who.tenantId]?.canonicalRoleIds;
  if (!canonical) throw new Error(`Missing canonical role configuration for tenant ${who.tenantId}`);
  const allowed = [canonical.staff, canonical.developer, canonical.owner].filter(Boolean).map(String);
  if (!allowed.length) throw new Error(`Missing canonical handoff role IDs for tenant ${who.tenantId}`);
  if (!allowed.some((roleId) => who.roleIds.includes(roleId))) throw new Error(`Authorization denied for engineering handoff in tenant ${who.tenantId}`);
}

function parseRepository(value) {
  const repository = String(value ?? '').trim();
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) throw new Error('repository must be owner/name');
  return repository;
}

function sourceKey(tenantId, sourceType, sourceId) {
  return `${tenantId}:${sourceType}:${sourceId}`;
}

export class HandoffEngine {
  constructor(options = {}) {
    this.authorization = options.authorization ?? {};
    this.allowedRepositories = new Set((options.allowedRepositories ?? ['pixenetwork/discord', 'pixenetwork/90210-github', 'pixenetwork/ai-orchestrator']).map(String));
    this.links = new Map();
    this.counter = 1;
  }

  linkGitHubIssue(input) {
    const who = actor(input?.actor);
    assertTenantModuleEnabled(who.tenantId, 'github_handoff');
    authorize(this.authorization, who);
    const repository = parseRepository(input?.repository);
    if (!this.allowedRepositories.has(repository)) throw new Error(`Repository ${repository} is not approved for engineering handoff`);
    const issueNumber = Number(input?.issueNumber);
    if (!Number.isInteger(issueNumber) || issueNumber < 1) throw new Error('issueNumber must be a positive integer');
    const sourceType = String(input?.sourceType ?? '').trim();
    const sourceId = String(input?.sourceId ?? '').trim();
    if (!sourceType || !sourceId) throw new Error('sourceType and sourceId are required');
    const key = sourceKey(who.tenantId, sourceType, sourceId);
    const existing = this.links.get(key);
    if (existing) {
      if (existing.repository !== repository || existing.issueNumber !== issueNumber) {
        throw new Error(`Source ${sourceType}:${sourceId} is already linked to another engineering issue`);
      }
      return clone(existing);
    }
    const record = {
      id: `handoff_${this.counter++}`,
      tenantId: who.tenantId,
      sourceType,
      sourceId,
      repository,
      issueNumber,
      status: 'linked',
      linkedBy: who.userId,
      linkedAt: iso(input?.now),
      lastSyncedAt: null,
      resolutionSummary: null,
      history: [],
    };
    record.history.push({ tenantId: who.tenantId, type: 'linked', actorId: who.userId, createdAt: record.linkedAt });
    this.links.set(key, record);
    return clone(record);
  }

  updateResolution(input) {
    const who = actor(input?.actor);
    assertTenantModuleEnabled(who.tenantId, 'resolution_sync');
    authorize(this.authorization, who);
    const sourceType = String(input?.sourceType ?? '').trim();
    const sourceId = String(input?.sourceId ?? '').trim();
    const record = this.links.get(sourceKey(who.tenantId, sourceType, sourceId));
    if (!record) throw new Error(`No engineering handoff exists for ${sourceType}:${sourceId} in tenant ${who.tenantId}`);
    const status = String(input?.status ?? '').trim().toLowerCase();
    if (!['linked', 'in_progress', 'resolved', 'closed', 'blocked'].includes(status)) throw new Error(`Unsupported handoff status: ${status}`);
    record.status = status;
    record.lastSyncedAt = iso(input?.now);
    record.resolutionSummary = String(input?.resolutionSummary ?? '').trim() || null;
    record.history.push({
      tenantId: who.tenantId,
      type: 'resolution_updated',
      actorId: who.userId,
      createdAt: record.lastSyncedAt,
      status,
    });
    return clone(record);
  }

  get(tenantId, sourceType, sourceId) {
    getTenantProfile(String(tenantId));
    const record = this.links.get(sourceKey(String(tenantId), String(sourceType), String(sourceId)));
    if (!record) throw new Error(`No engineering handoff exists for ${sourceType}:${sourceId} in tenant ${tenantId}`);
    return clone(record);
  }

  listTenant(tenantId) {
    getTenantProfile(String(tenantId));
    return [...this.links.values()].filter((record) => record.tenantId === String(tenantId)).map(clone);
  }
}

export function createHandoffEngine(options) {
  return new HandoffEngine(options);
}
