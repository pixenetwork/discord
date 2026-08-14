import crypto from 'node:crypto';
import { MODULE_BY_KEY } from './modules.mjs';
import { assertTenantModuleEnabled, getTenantProfile } from './tenants.mjs';

function iso(value = Date.now()) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error('A valid timestamp is required');
  return date.toISOString();
}

function actor(input) {
  if (!input?.userId || !input?.tenantId) throw new Error('Approval actor userId and tenantId are required');
  getTenantProfile(String(input.tenantId));
  return {
    userId: String(input.userId),
    tenantId: String(input.tenantId),
    roleIds: [...new Set((input.roleIds ?? []).map(String).filter(Boolean))],
  };
}

function digestPayload(payload) {
  const text = typeof payload === 'string' ? payload : JSON.stringify(payload ?? null);
  return crypto.createHash('sha256').update(text).digest('hex');
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export class ApprovalEngine {
  constructor(options = {}) {
    this.authorization = options.authorization ?? {};
    this.defaultTtlMs = Number.isSafeInteger(options.defaultTtlMs) && options.defaultTtlMs > 0 ? options.defaultTtlMs : 15 * 60 * 1000;
    this.requireSecondPerson = options.requireSecondPerson !== false;
    this.requests = new Map();
    this.counter = 1;
  }

  request(input) {
    const who = actor(input?.actor);
    const moduleKey = String(input?.moduleKey ?? '').trim();
    const module = MODULE_BY_KEY[moduleKey];
    if (!module) throw new Error(`Unknown Discord module: ${moduleKey}`);
    assertTenantModuleEnabled(who.tenantId, moduleKey);
    if (!module.approvalRequired) throw new Error(`Module ${moduleKey} is not approval-gated`);
    const action = String(input?.action ?? '').trim();
    if (!action) throw new Error('Approval action is required');
    const createdAt = iso(input?.now);
    const ttlMs = Number.isSafeInteger(input?.ttlMs) && input.ttlMs > 0 ? input.ttlMs : this.defaultTtlMs;
    const expiresAt = new Date(new Date(createdAt).getTime() + ttlMs).toISOString();
    const id = `approval_${this.counter++}`;
    const record = {
      id,
      tenantId: who.tenantId,
      moduleKey,
      action,
      payloadDigest: digestPayload(input?.payload),
      requestedBy: who.userId,
      createdAt,
      expiresAt,
      status: 'pending',
      decidedBy: null,
      decidedAt: null,
      decisionReason: null,
      consumedAt: null,
      consumedBy: null,
    };
    this.requests.set(id, record);
    return clone(record);
  }

  approve(input) {
    return this.#decide(input, 'approved');
  }

  reject(input) {
    return this.#decide(input, 'rejected');
  }

  consume(input) {
    const who = actor(input?.actor);
    const record = this.#record(input?.approvalId);
    this.#sameTenant(who, record);
    this.#expireIfNeeded(record, input?.now);
    if (record.status !== 'approved') throw new Error(`Approval ${record.id} is not approved`);
    if (record.consumedAt) throw new Error(`Approval ${record.id} was already consumed`);
    const expectedDigest = digestPayload(input?.payload);
    if (expectedDigest !== record.payloadDigest) throw new Error('Approval payload does not match the approved request');
    const moduleKey = String(input?.moduleKey ?? record.moduleKey);
    const action = String(input?.action ?? record.action);
    if (moduleKey !== record.moduleKey || action !== record.action) throw new Error('Approval scope does not match requested module/action');
    record.consumedAt = iso(input?.now);
    record.consumedBy = who.userId;
    return clone(record);
  }

  get(tenantId, approvalId, now = Date.now()) {
    getTenantProfile(String(tenantId));
    const record = this.#record(approvalId);
    if (record.tenantId !== String(tenantId)) throw new Error(`Approval ${approvalId} does not belong to tenant ${tenantId}`);
    this.#expireIfNeeded(record, now);
    return clone(record);
  }

  pending(tenantId, now = Date.now()) {
    getTenantProfile(String(tenantId));
    const result = [];
    for (const record of this.requests.values()) {
      if (record.tenantId !== String(tenantId)) continue;
      this.#expireIfNeeded(record, now);
      if (record.status === 'pending') result.push(clone(record));
    }
    return result;
  }

  #decide(input, status) {
    const who = actor(input?.actor);
    const record = this.#record(input?.approvalId);
    this.#sameTenant(who, record);
    this.#expireIfNeeded(record, input?.now);
    if (record.status !== 'pending') throw new Error(`Approval ${record.id} is already ${record.status}`);
    this.#authorizeApprover(who);
    if (this.requireSecondPerson && status === 'approved' && who.userId === record.requestedBy) {
      throw new Error('Approval requires a second person; requester cannot self-approve');
    }
    record.status = status;
    record.decidedBy = who.userId;
    record.decidedAt = iso(input?.now);
    record.decisionReason = String(input?.reason ?? '').trim() || null;
    return clone(record);
  }

  #authorizeApprover(who) {
    const config = this.authorization?.[who.tenantId];
    const aliases = config?.approvalRoleAliases ?? ['owner', 'admin'];
    const canonical = config?.canonicalRoleIds;
    if (!canonical) throw new Error(`Missing canonical role configuration for tenant ${who.tenantId}`);
    const allowed = aliases.map((alias) => canonical[alias]).filter(Boolean).map(String);
    if (!allowed.length) throw new Error(`Missing canonical approval role IDs for tenant ${who.tenantId}`);
    if (!allowed.some((roleId) => who.roleIds.includes(roleId))) {
      throw new Error(`Authorization denied for approval decision in tenant ${who.tenantId}`);
    }
  }

  #record(id) {
    const record = this.requests.get(String(id));
    if (!record) throw new Error(`Unknown approval: ${id}`);
    return record;
  }

  #sameTenant(who, record) {
    if (who.tenantId !== record.tenantId) throw new Error(`Cross-tenant approval access denied: ${who.tenantId} -> ${record.tenantId}`);
  }

  #expireIfNeeded(record, now) {
    if (record.status !== 'pending') return;
    if (new Date(iso(now)).getTime() >= new Date(record.expiresAt).getTime()) {
      record.status = 'expired';
      record.decidedAt = iso(now);
      record.decisionReason = 'expired';
    }
  }
}

export function createApprovalEngine(options) {
  return new ApprovalEngine(options);
}

export { digestPayload };
