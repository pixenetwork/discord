import crypto from 'node:crypto';
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
  return requireVerifiedActor(input, 'commerce actor');
}

function ensureMoney(cents) {
  if (!Number.isSafeInteger(cents) || cents < 0) throw new Error('amountCents must be a non-negative safe integer');
  return cents;
}

function authorize(authorization, who, aliases = ['staff', 'integration']) {
  const canonical = authorization?.[who.tenantId]?.canonicalRoleIds;
  if (!canonical) throw new Error(`Missing canonical role configuration for tenant ${who.tenantId}`);
  if (!Array.isArray(who.roleIds) || who.roleIds.length === 0) {
    throw new Error(`Authorization denied for commerce operation in tenant ${who.tenantId}`);
  }
  const allowed = aliases.map((alias) => canonical[alias]).filter(Boolean).map(String);
  if (!allowed.length) throw new Error(`Missing canonical commerce role IDs for tenant ${who.tenantId}`);
  if (!allowed.some((roleId) => who.roleIds.includes(roleId))) throw new Error(`Authorization denied for commerce operation in tenant ${who.tenantId}`);
}

function key(tenantId, id) {
  return `${tenantId}:${id}`;
}

function timingSafeEqualString(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export class CommerceEngine {
  constructor(options = {}) {
    this.authorization = options.authorization ?? {};
    this.hmacSecret = options.hmacSecret != null ? String(options.hmacSecret) : null;
    this.transactions = new Map();
    this.entitlements = new Map();
    this.flags = new Map();
    this.flagCounter = 1;
  }

  /**
   * Record Tebex verification from an HMAC-verified webhook payload.
   * Entitlements are granted only when the verified payload status is `verified`.
   * Caller-supplied status without a valid HMAC cannot grant entitlements.
   */
  recordTebexVerification(input) {
    const who = actor(input?.actor);
    assertTenantModuleEnabled(who.tenantId, 'tebex_verification');
    authorize(this.authorization, who);
    const payload = this.#verifiedWebhookPayload(input);
    const transactionId = String(payload.transactionId ?? '').trim();
    const subjectId = String(payload.subjectId ?? '').trim();
    if (!transactionId) throw new Error('transactionId is required');
    if (!subjectId) throw new Error('subjectId is required');
    const status = String(payload.status ?? '').toLowerCase();
    if (!['verified', 'invalid', 'refunded', 'chargeback'].includes(status)) throw new Error(`Unsupported Tebex verification status: ${status}`);
    const productIds = [...new Set((payload.productIds ?? []).map(String).map((id) => id.trim()).filter(Boolean))];
    const record = {
      transactionId,
      tenantId: who.tenantId,
      subjectId,
      status,
      productIds,
      amountCents: ensureMoney(payload.amountCents ?? 0),
      currency: String(payload.currency ?? 'USD').toUpperCase(),
      hmacVerified: true,
      verifiedBy: who.userId,
      verifiedAt: iso(input?.now),
    };
    const storageKey = key(who.tenantId, transactionId);
    const existing = this.transactions.get(storageKey);
    if (existing) {
      if (
        existing.status !== record.status
        || existing.subjectId !== subjectId
        || existing.productIds.join(',') !== productIds.join(',')
      ) {
        throw new Error(`Transaction ${transactionId} already exists with different verification evidence`);
      }
      return clone(existing);
    }
    this.transactions.set(storageKey, record);
    if (status === 'verified') {
      for (const productId of productIds) this.#grantEntitlement(who.tenantId, subjectId, productId, transactionId, input?.now);
    }
    if (['refunded', 'chargeback'].includes(status)) {
      for (const productId of productIds) this.#revokeEntitlement(who.tenantId, subjectId, productId, status, input?.now);
    }
    return clone(record);
  }

  transaction(input) {
    const who = actor(input?.actor);
    authorize(this.authorization, who);
    const transactionId = String(input?.transactionId ?? '');
    const record = this.transactions.get(key(who.tenantId, transactionId));
    if (!record) throw new Error(`Unknown transaction ${transactionId} in tenant ${who.tenantId}`);
    return clone(record);
  }

  entitlement(input) {
    const who = actor(input?.actor);
    authorize(this.authorization, who);
    assertTenantModuleEnabled(who.tenantId, 'license_entitlements');
    const subjectId = String(input?.subjectId ?? '');
    const productId = String(input?.productId ?? '');
    const record = this.entitlements.get(key(who.tenantId, `${subjectId}:${productId}`));
    return record ? clone(record) : null;
  }

  hasEntitlement(input) {
    const record = this.entitlement(input);
    return Boolean(record?.active);
  }

  supportAccess(input) {
    const who = actor(input?.actor);
    authorize(this.authorization, who);
    assertTenantModuleEnabled(who.tenantId, 'customer_script_support');
    assertTenantModuleEnabled(who.tenantId, 'license_entitlements');
    const subjectId = String(input?.subjectId ?? '').trim();
    const productId = String(input?.productId ?? '').trim();
    if (!subjectId || !productId) throw new Error('subjectId and productId are required');
    const entitlement = this.entitlement({ actor: who, subjectId, productId });
    return Object.freeze({
      tenantId: who.tenantId,
      subjectId,
      productId,
      allowed: Boolean(entitlement?.active),
      reason: entitlement?.active ? 'verified_entitlement' : 'entitlement_required',
      transactionId: entitlement?.transactionId ?? null,
    });
  }

  createFraudFlag(input) {
    const who = actor(input?.actor);
    assertTenantModuleEnabled(who.tenantId, 'tebex_fraud_flags');
    authorize(this.authorization, who, ['staff']);
    const transactionId = String(input?.transactionId ?? '').trim();
    const transaction = this.transactions.get(key(who.tenantId, transactionId));
    if (!transaction) throw new Error(`Unknown transaction ${transactionId} in tenant ${who.tenantId}`);
    const reason = String(input?.reason ?? '').trim();
    if (!reason) throw new Error('Fraud review reason is required');
    const flag = {
      id: `fraud_${this.flagCounter++}`,
      tenantId: who.tenantId,
      transactionId,
      reason,
      severity: ['low', 'medium', 'high'].includes(input?.severity) ? input.severity : 'medium',
      status: 'open',
      createdBy: who.userId,
      createdAt: iso(input?.now),
      resolvedBy: null,
      resolvedAt: null,
      resolution: null,
    };
    this.flags.set(key(who.tenantId, flag.id), flag);
    return clone(flag);
  }

  resolveFraudFlag(input) {
    const who = actor(input?.actor);
    assertTenantModuleEnabled(who.tenantId, 'tebex_fraud_flags');
    authorize(this.authorization, who, ['staff']);
    const flag = this.flags.get(key(who.tenantId, String(input?.flagId)));
    if (!flag) throw new Error(`Unknown fraud flag ${input?.flagId} in tenant ${who.tenantId}`);
    if (flag.status === 'resolved') return clone(flag);
    flag.status = 'resolved';
    flag.resolvedBy = who.userId;
    flag.resolvedAt = iso(input?.now);
    flag.resolution = String(input?.resolution ?? '').trim() || 'reviewed';
    return clone(flag);
  }

  openFraudFlags(input) {
    const who = actor(input?.actor);
    authorize(this.authorization, who, ['staff']);
    assertTenantModuleEnabled(who.tenantId, 'tebex_fraud_flags');
    return [...this.flags.values()].filter((flag) => flag.tenantId === who.tenantId && flag.status === 'open').map(clone);
  }

  signWebhookPayload(payload) {
    if (!this.hmacSecret) throw new Error('Tebex HMAC secret is not configured');
    const rawBody = typeof payload === 'string' ? payload : JSON.stringify(payload ?? null);
    return {
      rawBody,
      hmacSignature: crypto.createHmac('sha256', this.hmacSecret).update(rawBody).digest('hex'),
    };
  }

  #verifiedWebhookPayload(input) {
    if (!this.hmacSecret) throw new Error('Tebex HMAC secret is not configured');
    const rawBody = input?.rawBody;
    const provided = input?.hmacSignature ?? input?.signature;
    if (typeof rawBody !== 'string') {
      throw new Error('Tebex rawBody must be a string');
    }
    if (provided == null) {
      throw new Error('Tebex HMAC verification failed: rawBody and hmacSignature are required');
    }
    const expectedHex = crypto.createHmac('sha256', this.hmacSecret).update(rawBody).digest('hex');
    const expectedBase64 = crypto.createHmac('sha256', this.hmacSecret).update(rawBody).digest('base64');
    const valid = timingSafeEqualString(expectedHex, provided) || timingSafeEqualString(expectedBase64, provided);
    if (!valid) throw new Error('Invalid Tebex HMAC signature');
    let parsed;
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      throw new Error('Tebex webhook payload must be valid JSON after HMAC verification');
    }
    if (!parsed || typeof parsed !== 'object') throw new Error('Tebex webhook payload must be an object');
    return parsed;
  }

  #grantEntitlement(tenantId, subjectId, productId, transactionId, now) {
    assertTenantModuleEnabled(tenantId, 'license_entitlements');
    const storageKey = key(tenantId, `${subjectId}:${productId}`);
    const previous = this.entitlements.get(storageKey);
    this.entitlements.set(storageKey, {
      tenantId,
      subjectId,
      productId,
      active: true,
      transactionId,
      grantedAt: previous?.grantedAt ?? iso(now),
      updatedAt: iso(now),
      revokedAt: null,
      revokeReason: null,
    });
  }

  #revokeEntitlement(tenantId, subjectId, productId, reason, now) {
    assertTenantModuleEnabled(tenantId, 'license_entitlements');
    const storageKey = key(tenantId, `${subjectId}:${productId}`);
    const previous = this.entitlements.get(storageKey);
    if (!previous) return;
    this.entitlements.set(storageKey, {
      ...previous,
      active: false,
      updatedAt: iso(now),
      revokedAt: iso(now),
      revokeReason: reason,
    });
  }
}

export function createCommerceEngine(options) {
  return new CommerceEngine(options);
}
