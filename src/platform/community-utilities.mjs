import { MODULE_BY_KEY } from './modules.mjs';
import { assertTenantBoundary, assertTenantModuleEnabled, getTenantProfile } from './tenants.mjs';

const DEFAULT_ACTION_ROLES = Object.freeze({
  manage_content: Object.freeze(['staff']),
  manage_polls: Object.freeze(['staff']),
  manage_translation: Object.freeze(['staff']),
  manage_roles: Object.freeze(['staff']),
  approve_role_mutation: Object.freeze(['owner', 'admin']),
  review_feedback: Object.freeze(['staff']),
  review_status_blacklist: Object.freeze(['staff']),
  plan_mass_unban: Object.freeze(['owner', 'admin']),
});

const POLICY_MODULE_KEYS = Object.freeze({
  vanity: 'vanity_roles',
  sticky: 'sticky_roles',
  auto: 'auto_roles',
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
  if (!input?.userId || !input?.tenantId) throw new Error('Community actor userId and tenantId are required');
  getTenantProfile(String(input.tenantId));
  return {
    userId: String(input.userId),
    tenantId: String(input.tenantId),
    roleIds: [...new Set((input.roleIds ?? []).map(String).filter(Boolean))],
  };
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
  if (!allowed.some((id) => who.roleIds.includes(id))) {
    throw new Error(`Authorization denied for ${action} in tenant ${who.tenantId}`);
  }
}

function ensurePolicyType(policyType) {
  const key = String(policyType ?? '').trim().toLowerCase();
  if (!Object.hasOwn(POLICY_MODULE_KEYS, key)) throw new Error(`Unknown role policy type: ${policyType}`);
  return key;
}

function key(tenantId, recordId) {
  return `${tenantId}:${recordId}`;
}

export class CommunityUtilitiesEngine {
  constructor(options = {}) {
    this.authorization = options.authorization ?? {};
    this.requireRoleMutationApproval = options.requireRoleMutationApproval !== false;
    this.state = new Map();
    this.counter = 1;
  }

  upsertStickyMessage(input) {
    const who = actor(input?.actor);
    assertTenantModuleEnabled(who.tenantId, 'sticky_messages');
    authorize(this.authorization, who, 'manage_content');
    const channelId = String(input?.channelId ?? '').trim();
    const content = String(input?.content ?? '').trim();
    if (!channelId || !content) throw new Error('channelId and content are required');
    const tenant = this.#tenant(who.tenantId);
    const record = {
      id: `sticky_${channelId}`,
      tenantId: who.tenantId,
      channelId,
      content,
      updatedBy: who.userId,
      updatedAt: iso(input?.now),
    };
    tenant.stickyMessages.set(channelId, record);
    this.#audit(who, 'sticky_message_upserted', record.id, input?.now, { channelId });
    return clone(record);
  }

  upsertKeywordResponse(input) {
    const who = actor(input?.actor);
    assertTenantModuleEnabled(who.tenantId, 'keyword_responses');
    authorize(this.authorization, who, 'manage_content');
    const keyword = String(input?.keyword ?? '').trim().toLowerCase();
    const response = String(input?.response ?? '').trim();
    if (!keyword || !response) throw new Error('keyword and response are required');
    const tenant = this.#tenant(who.tenantId);
    const record = {
      id: `keyword_${keyword}`,
      tenantId: who.tenantId,
      keyword,
      response,
      exactMatch: input?.exactMatch === true,
      updatedBy: who.userId,
      updatedAt: iso(input?.now),
    };
    tenant.keywordResponses.set(keyword, record);
    this.#audit(who, 'keyword_response_upserted', record.id, input?.now, { keyword });
    return clone(record);
  }

  setWelcomeResponder(input) {
    return this.#setResponder(input, 'welcome', 'welcome');
  }

  setBoosterResponder(input) {
    return this.#setResponder(input, 'booster', 'booster_responder');
  }

  createPoll(input) {
    const who = actor(input?.actor);
    assertTenantModuleEnabled(who.tenantId, 'polls');
    authorize(this.authorization, who, 'manage_polls');
    const question = String(input?.question ?? '').trim();
    const options = [...new Set((input?.options ?? []).map((value) => String(value).trim()).filter(Boolean))];
    if (!question) throw new Error('Poll question is required');
    if (options.length < 2) throw new Error('Poll must have at least two options');
    const id = `poll_${this.counter++}`;
    const record = {
      id,
      tenantId: who.tenantId,
      channelId: String(input?.channelId ?? '').trim() || null,
      question,
      options,
      status: 'open',
      createdBy: who.userId,
      createdAt: iso(input?.now),
      closedAt: null,
      votes: [],
    };
    this.#tenant(who.tenantId).polls.set(id, record);
    this.#audit(who, 'poll_created', id, input?.now, { question });
    return clone(record);
  }

  closePoll(input) {
    const who = actor(input?.actor);
    assertTenantModuleEnabled(who.tenantId, 'polls');
    authorize(this.authorization, who, 'manage_polls');
    const poll = this.#record(who.tenantId, 'polls', input?.pollId, 'Unknown poll');
    poll.status = 'closed';
    poll.closedAt = iso(input?.now);
    this.#audit(who, 'poll_closed', poll.id, input?.now);
    return clone(poll);
  }

  createTranslationRequest(input) {
    const who = actor(input?.actor);
    assertTenantModuleEnabled(who.tenantId, 'translation');
    const sourceText = String(input?.sourceText ?? '').trim();
    const targetLanguage = String(input?.targetLanguage ?? '').trim();
    if (!sourceText || !targetLanguage) throw new Error('sourceText and targetLanguage are required');
    const id = `translation_${this.counter++}`;
    const record = {
      id,
      tenantId: who.tenantId,
      sourceText,
      sourceLanguage: String(input?.sourceLanguage ?? '').trim() || null,
      targetLanguage,
      context: String(input?.context ?? '').trim() || null,
      status: 'requested',
      translatedText: null,
      requestedBy: who.userId,
      requestedAt: iso(input?.now),
      reviewedBy: null,
      reviewedAt: null,
      reviewReason: null,
    };
    this.#tenant(who.tenantId).translationRequests.set(id, record);
    this.#audit(who, 'translation_requested', id, input?.now, { targetLanguage });
    return clone(record);
  }

  reviewTranslationRequest(input) {
    const who = actor(input?.actor);
    assertTenantModuleEnabled(who.tenantId, 'translation');
    authorize(this.authorization, who, 'manage_translation');
    const record = this.#record(who.tenantId, 'translationRequests', input?.requestId, 'Unknown translation request');
    const status = String(input?.status ?? '').trim().toLowerCase();
    if (!['completed', 'rejected'].includes(status)) throw new Error('Translation review status must be completed or rejected');
    record.status = status;
    record.translatedText = status === 'completed' ? String(input?.translatedText ?? '').trim() || null : null;
    record.reviewedBy = who.userId;
    record.reviewedAt = iso(input?.now);
    record.reviewReason = String(input?.reason ?? '').trim() || null;
    this.#audit(who, 'translation_reviewed', record.id, input?.now, { status });
    return clone(record);
  }

  proposeRolePolicyMutation(input) {
    const who = actor(input?.actor);
    const policyType = ensurePolicyType(input?.policyType);
    const moduleKey = POLICY_MODULE_KEYS[policyType];
    assertTenantModuleEnabled(who.tenantId, moduleKey);
    authorize(this.authorization, who, 'manage_roles');

    const roleIds = [...new Set((input?.roleIds ?? []).map(String).filter(Boolean))];
    const mutationId = `role_mutation_${this.counter++}`;
    const status = this.requireRoleMutationApproval || input?.forceApproval === true ? 'pending_approval' : 'approved';
    const mutation = {
      id: mutationId,
      tenantId: who.tenantId,
      policyType,
      moduleKey,
      roleIds,
      requestedBy: who.userId,
      requestedAt: iso(input?.now),
      status,
      reviewedBy: null,
      reviewedAt: null,
      reviewReason: null,
    };
    const tenant = this.#tenant(who.tenantId);
    tenant.roleMutations.set(mutationId, mutation);
    if (status === 'approved') tenant.rolePolicies[policyType] = roleIds;
    this.#audit(who, 'role_policy_mutation_proposed', mutationId, input?.now, { policyType, status });
    return clone(mutation);
  }

  reviewRolePolicyMutation(input) {
    const who = actor(input?.actor);
    authorize(this.authorization, who, 'approve_role_mutation');
    const mutation = this.#record(who.tenantId, 'roleMutations', input?.mutationId, 'Unknown role mutation');
    assertTenantBoundary({ actorTenant: who.tenantId, targetTenant: mutation.tenantId, actorIsOwner: false });
    if (mutation.status !== 'pending_approval') throw new Error(`Role mutation ${mutation.id} is already ${mutation.status}`);
    const decision = String(input?.decision ?? '').trim().toLowerCase();
    if (!['approved', 'rejected'].includes(decision)) throw new Error('Role mutation decision must be approved or rejected');
    mutation.status = decision;
    mutation.reviewedBy = who.userId;
    mutation.reviewedAt = iso(input?.now);
    mutation.reviewReason = String(input?.reason ?? '').trim() || null;
    if (decision === 'approved') this.#tenant(who.tenantId).rolePolicies[mutation.policyType] = mutation.roleIds;
    this.#audit(who, 'role_policy_mutation_reviewed', mutation.id, input?.now, { decision });
    return clone(mutation);
  }

  submitStaffFeedback(input) {
    const who = actor(input?.actor);
    assertTenantModuleEnabled(who.tenantId, 'staff_feedback');
    const targetUserId = String(input?.targetUserId ?? '').trim();
    const comment = String(input?.comment ?? '').trim();
    const rating = Number(input?.rating);
    if (!targetUserId || !comment) throw new Error('targetUserId and comment are required');
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new Error('rating must be an integer from 1 to 5');
    const id = `feedback_${this.counter++}`;
    const record = {
      id,
      tenantId: who.tenantId,
      targetUserId,
      comment,
      rating,
      submittedBy: who.userId,
      submittedAt: iso(input?.now),
      status: 'open',
      reviews: [],
    };
    this.#tenant(who.tenantId).staffFeedback.set(id, record);
    this.#audit(who, 'staff_feedback_submitted', id, input?.now, { targetUserId, rating });
    return clone(record);
  }

  reviewStaffFeedback(input) {
    const who = actor(input?.actor);
    assertTenantModuleEnabled(who.tenantId, 'staff_feedback');
    authorize(this.authorization, who, 'review_feedback');
    const feedback = this.#record(who.tenantId, 'staffFeedback', input?.feedbackId, 'Unknown staff feedback');
    const decision = String(input?.decision ?? '').trim().toLowerCase();
    if (!['acknowledged', 'actioned', 'dismissed'].includes(decision)) throw new Error('Invalid feedback review decision');
    const review = {
      tenantId: who.tenantId,
      feedbackId: feedback.id,
      reviewerId: who.userId,
      decision,
      reason: String(input?.reason ?? '').trim() || null,
      createdAt: iso(input?.now),
    };
    feedback.reviews.push(review);
    feedback.status = decision;
    this.#audit(who, 'staff_feedback_reviewed', feedback.id, input?.now, { decision });
    return clone(feedback);
  }

  createStatusBlacklistReview(input) {
    const who = actor(input?.actor);
    assertTenantModuleEnabled(who.tenantId, 'status_blacklist');
    authorize(this.authorization, who, 'review_status_blacklist');
    const memberId = String(input?.memberId ?? '').trim();
    const statusText = String(input?.statusText ?? '').trim();
    if (!memberId || !statusText) throw new Error('memberId and statusText are required');
    const id = `status_review_${this.counter++}`;
    const record = {
      id,
      tenantId: who.tenantId,
      memberId,
      statusText,
      createdBy: who.userId,
      createdAt: iso(input?.now),
      state: 'open',
      decision: null,
      decidedBy: null,
      decidedAt: null,
      reason: null,
    };
    this.#tenant(who.tenantId).statusBlacklistReviews.set(id, record);
    this.#audit(who, 'status_blacklist_review_created', id, input?.now, { memberId });
    return clone(record);
  }

  resolveStatusBlacklistReview(input) {
    const who = actor(input?.actor);
    assertTenantModuleEnabled(who.tenantId, 'status_blacklist');
    authorize(this.authorization, who, 'review_status_blacklist');
    const record = this.#record(who.tenantId, 'statusBlacklistReviews', input?.reviewId, 'Unknown status blacklist review');
    const decision = String(input?.decision ?? '').trim().toLowerCase();
    if (!['allow', 'warn', 'remove_status'].includes(decision)) throw new Error('Invalid status blacklist decision');
    record.state = 'closed';
    record.decision = decision;
    record.decidedBy = who.userId;
    record.decidedAt = iso(input?.now);
    record.reason = String(input?.reason ?? '').trim() || null;
    this.#audit(who, 'status_blacklist_review_resolved', record.id, input?.now, { decision });
    return clone(record);
  }

  planMassUnban(input) {
    const who = actor(input?.actor);
    assertTenantModuleEnabled(who.tenantId, 'mass_unban');
    authorize(this.authorization, who, 'plan_mass_unban');
    if (!MODULE_BY_KEY.mass_unban?.approvalRequired) throw new Error('mass_unban must remain approval-gated');
    const id = `mass_unban_plan_${this.counter++}`;
    const record = {
      id,
      tenantId: who.tenantId,
      scope: String(input?.scope ?? 'all').trim() || 'all',
      reason: String(input?.reason ?? '').trim() || null,
      createdBy: who.userId,
      createdAt: iso(input?.now),
      approvalStatus: 'pending',
      approvedBy: null,
      approvedAt: null,
      approvalReason: null,
      executionDisabled: true,
    };
    this.#tenant(who.tenantId).massUnbanPlans.set(id, record);
    this.#audit(who, 'mass_unban_plan_created', id, input?.now, { scope: record.scope, executionDisabled: true });
    return clone(record);
  }

  reviewMassUnbanPlan(input) {
    const who = actor(input?.actor);
    authorize(this.authorization, who, 'approve_role_mutation');
    const plan = this.#record(who.tenantId, 'massUnbanPlans', input?.planId, 'Unknown mass unban plan');
    const decision = String(input?.decision ?? '').trim().toLowerCase();
    if (!['approved', 'rejected'].includes(decision)) throw new Error('Mass unban decision must be approved or rejected');
    plan.approvalStatus = decision;
    plan.approvedBy = who.userId;
    plan.approvedAt = iso(input?.now);
    plan.approvalReason = String(input?.reason ?? '').trim() || null;
    this.#audit(who, 'mass_unban_plan_reviewed', plan.id, input?.now, { decision, executionDisabled: true });
    return clone(plan);
  }

  snapshot(tenantId) {
    const tenantKey = getTenantProfile(String(tenantId)).key;
    const tenant = this.#tenant(tenantKey);
    return Object.freeze({
      tenantId: tenantKey,
      stickyMessages: Object.freeze([...tenant.stickyMessages.values()].map(clone)),
      keywordResponses: Object.freeze([...tenant.keywordResponses.values()].map(clone)),
      welcomeResponder: tenant.welcomeResponder ? Object.freeze(clone(tenant.welcomeResponder)) : null,
      boosterResponder: tenant.boosterResponder ? Object.freeze(clone(tenant.boosterResponder)) : null,
      polls: Object.freeze([...tenant.polls.values()].map(clone)),
      translationRequests: Object.freeze([...tenant.translationRequests.values()].map(clone)),
      rolePolicies: Object.freeze(clone(tenant.rolePolicies)),
      roleMutations: Object.freeze([...tenant.roleMutations.values()].map(clone)),
      staffFeedback: Object.freeze([...tenant.staffFeedback.values()].map(clone)),
      statusBlacklistReviews: Object.freeze([...tenant.statusBlacklistReviews.values()].map(clone)),
      massUnbanPlans: Object.freeze([...tenant.massUnbanPlans.values()].map(clone)),
      auditTrail: Object.freeze([...tenant.auditTrail].map(clone)),
    });
  }

  #setResponder(input, keyName, moduleKey) {
    const who = actor(input?.actor);
    assertTenantModuleEnabled(who.tenantId, moduleKey);
    authorize(this.authorization, who, 'manage_content');
    const record = {
      id: `${keyName}_responder`,
      tenantId: who.tenantId,
      enabled: input?.enabled !== false,
      channelId: String(input?.channelId ?? '').trim() || null,
      template: String(input?.template ?? '').trim() || null,
      updatedBy: who.userId,
      updatedAt: iso(input?.now),
    };
    this.#tenant(who.tenantId)[`${keyName}Responder`] = record;
    this.#audit(who, `${keyName}_responder_set`, record.id, input?.now);
    return clone(record);
  }

  #tenant(tenantId) {
    const keyName = getTenantProfile(String(tenantId)).key;
    if (!this.state.has(keyName)) {
      this.state.set(keyName, {
        stickyMessages: new Map(),
        keywordResponses: new Map(),
        welcomeResponder: null,
        boosterResponder: null,
        polls: new Map(),
        translationRequests: new Map(),
        rolePolicies: { vanity: [], sticky: [], auto: [] },
        roleMutations: new Map(),
        staffFeedback: new Map(),
        statusBlacklistReviews: new Map(),
        massUnbanPlans: new Map(),
        auditTrail: [],
      });
    }
    return this.state.get(keyName);
  }

  #record(tenantId, collection, id, notFoundMessage) {
    const tenantKey = getTenantProfile(String(tenantId)).key;
    const tenant = this.#tenant(tenantKey);
    const record = tenant[collection].get(String(id));
    if (!record) {
      for (const [otherTenant, state] of this.state.entries()) {
        if (otherTenant === tenantKey) continue;
        if (state[collection].has(String(id))) {
          throw new Error(`Cross-tenant access denied: ${tenantKey} -> ${otherTenant}`);
        }
      }
      throw new Error(`${notFoundMessage}: ${id}`);
    }
    return record;
  }

  #audit(who, action, entityId, now, details = {}) {
    const event = {
      id: `audit_${this.counter++}`,
      tenantId: who.tenantId,
      action,
      entityId,
      actorId: who.userId,
      createdAt: iso(now),
      ...details,
    };
    this.#tenant(who.tenantId).auditTrail.push(event);
    return event;
  }
}

export function createCommunityUtilitiesEngine(options) {
  return new CommunityUtilitiesEngine(options);
}

export { DEFAULT_ACTION_ROLES, POLICY_MODULE_KEYS };
