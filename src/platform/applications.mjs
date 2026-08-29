import { requireVerifiedActor } from './discord-identity.mjs';
import { assertTenantBoundary, assertTenantModuleEnabled, getTenantProfile } from './tenants.mjs';

const DEFAULT_APPLICATION_TYPES = Object.freeze({
  staff: Object.freeze({ key: 'staff', label: 'Staff Application' }),
  pd: Object.freeze({ key: 'pd', label: 'Police Department Application' }),
  ems: Object.freeze({ key: 'ems', label: 'EMS Application' }),
  mechanic: Object.freeze({ key: 'mechanic', label: 'Mechanic Application' }),
  custom: Object.freeze({ key: 'custom', label: 'Custom Application' }),
});

const DEFAULT_ACTION_ROLES = Object.freeze({
  manage_application_definitions: Object.freeze(['staff']),
  review_application: Object.freeze(['staff']),
  manage_verification_panels: Object.freeze(['staff']),
  plan_role_assignment: Object.freeze(['staff']),
  approve_role_assignment: Object.freeze(['owner', 'admin']),
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
  return requireVerifiedActor(input, 'application actor');
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

function normalizeTypeKey(typeKey) {
  const value = String(typeKey ?? '').trim().toLowerCase();
  if (!value) throw new Error('typeKey is required');
  if (Object.hasOwn(DEFAULT_APPLICATION_TYPES, value)) return value;
  if (!value.startsWith('custom:')) throw new Error(`Unsupported application type: ${typeKey}`);
  const customKey = value.slice('custom:'.length).trim();
  if (!customKey) throw new Error('Custom application type must include a key');
  return `custom:${customKey}`;
}

function ensureQuestions(questions) {
  const normalized = (questions ?? []).map((question) => String(question).trim()).filter(Boolean);
  if (!normalized.length) throw new Error('At least one application question is required');
  return [...new Set(normalized)];
}

export class ApplicationsEngine {
  constructor(options = {}) {
    this.authorization = options.authorization ?? {};
    this.requireRoleAssignmentApproval = options.requireRoleAssignmentApproval !== false;
    this.state = new Map();
    this.counter = 1;
  }

  upsertApplicationDefinition(input) {
    const who = actor(input?.actor);
    assertTenantModuleEnabled(who.tenantId, 'applications');
    assertTenantModuleEnabled(who.tenantId, 'application_builder');
    authorize(this.authorization, who, 'manage_application_definitions');
    const typeKey = normalizeTypeKey(input?.typeKey);
    const fallback = DEFAULT_APPLICATION_TYPES[typeKey] ?? DEFAULT_APPLICATION_TYPES.custom;
    const record = {
      typeKey,
      tenantId: who.tenantId,
      label: String(input?.label ?? fallback.label).trim() || fallback.label,
      enabled: input?.enabled !== false,
      questions: ensureQuestions(input?.questions ?? ['Why should we accept this application?']),
      updatedBy: who.userId,
      updatedAt: iso(input?.now),
    };
    this.#tenant(who.tenantId).definitions.set(typeKey, record);
    this.#audit(who, 'application_definition_upserted', typeKey, input?.now);
    return clone(record);
  }

  applicationDefinitions(tenantId) {
    const key = getTenantProfile(String(tenantId)).key;
    return [...this.#tenant(key).definitions.values()].map(clone);
  }

  submitApplication(input) {
    const who = actor(input?.actor);
    assertTenantModuleEnabled(who.tenantId, 'applications');
    const typeKey = normalizeTypeKey(input?.typeKey);
    const definition = this.#definition(who.tenantId, typeKey);
    if (!definition.enabled) throw new Error(`Application type ${typeKey} is disabled in tenant ${who.tenantId}`);
    const answers = Object.fromEntries(Object.entries(input?.answers ?? {}).map(([question, value]) => [String(question), String(value ?? '').trim()]));
    const id = `application_${this.counter++}`;
    const submittedAt = iso(input?.now);
    const record = {
      id,
      tenantId: who.tenantId,
      typeKey,
      applicantId: who.userId,
      answers,
      status: 'submitted',
      submittedAt,
      submittedBy: who.userId,
      reviews: [],
      history: [{ tenantId: who.tenantId, type: 'submitted', actorId: who.userId, createdAt: submittedAt }],
      roleAssignmentPlanId: null,
    };
    this.#tenant(who.tenantId).submissions.set(id, record);
    this.#audit(who, 'application_submitted', id, input?.now, { typeKey });
    return clone(record);
  }

  reviewApplication(input) {
    const who = actor(input?.actor);
    assertTenantModuleEnabled(who.tenantId, 'application_decisions');
    authorize(this.authorization, who, 'review_application');
    const submission = this.#record(who.tenantId, 'submissions', input?.submissionId, 'Unknown application submission');
    assertTenantBoundary({ actorTenant: who.tenantId, targetTenant: submission.tenantId, actorIsOwner: false });
    const decision = String(input?.decision ?? '').trim().toLowerCase();
    if (!['approved', 'rejected', 'needs_info'].includes(decision)) throw new Error('Application decision must be approved, rejected, or needs_info');
    const reason = String(input?.reason ?? '').trim();
    if (decision !== 'approved' && !reason) throw new Error('A decision reason is required unless decision is approved');
    const review = {
      tenantId: who.tenantId,
      reviewerId: who.userId,
      decision,
      reason: reason || null,
      createdAt: iso(input?.now),
    };
    submission.status = decision;
    submission.reviews.push(review);
    submission.history.push({ tenantId: who.tenantId, type: 'decision_recorded', actorId: who.userId, createdAt: review.createdAt, decision });
    this.#audit(who, 'application_reviewed', submission.id, input?.now, { decision });
    return clone(submission);
  }

  createVerificationPanel(input) {
    const who = actor(input?.actor);
    assertTenantModuleEnabled(who.tenantId, 'verification');
    authorize(this.authorization, who, 'manage_verification_panels');
    const panelKey = String(input?.panelKey ?? '').trim().toLowerCase();
    if (!panelKey) throw new Error('panelKey is required');
    const id = `verification_${panelKey}`;
    const record = {
      id,
      panelKey,
      tenantId: who.tenantId,
      title: String(input?.title ?? 'Verification').trim() || 'Verification',
      description: String(input?.description ?? '').trim() || null,
      stickyRoleIds: [...new Set((input?.stickyRoleIds ?? []).map(String).filter(Boolean))],
      autoRoleIds: [...new Set((input?.autoRoleIds ?? []).map(String).filter(Boolean))],
      updatedBy: who.userId,
      updatedAt: iso(input?.now),
    };
    this.#tenant(who.tenantId).verificationPanels.set(id, record);
    this.#audit(who, 'verification_panel_upserted', id, input?.now, { panelKey });
    return clone(record);
  }

  planRoleAssignment(input) {
    const who = actor(input?.actor);
    assertTenantModuleEnabled(who.tenantId, 'application_roles');
    authorize(this.authorization, who, 'plan_role_assignment');
    const submission = this.#record(who.tenantId, 'submissions', input?.submissionId, 'Unknown application submission');
    if (submission.status !== 'approved') throw new Error(`Role assignment planning requires an approved application; current status is ${submission.status}`);
    const stickyRoleIds = [...new Set((input?.stickyRoleIds ?? []).map(String).filter(Boolean))];
    const autoRoleIds = [...new Set((input?.autoRoleIds ?? []).map(String).filter(Boolean))];
    if (!stickyRoleIds.length && !autoRoleIds.length) throw new Error('At least one stickyRoleIds or autoRoleIds value is required');
    const planId = `role_plan_${this.counter++}`;
    const status = this.requireRoleAssignmentApproval || input?.forceApproval === true ? 'pending_approval' : 'approved';
    const plan = {
      id: planId,
      tenantId: who.tenantId,
      submissionId: submission.id,
      stickyRoleIds,
      autoRoleIds,
      status,
      createdBy: who.userId,
      createdAt: iso(input?.now),
      approvedBy: null,
      approvedAt: null,
      approvalReason: null,
      executionMode: 'planned_only',
    };
    this.#tenant(who.tenantId).roleAssignmentPlans.set(planId, plan);
    submission.roleAssignmentPlanId = planId;
    submission.history.push({ tenantId: who.tenantId, type: 'role_assignment_planned', actorId: who.userId, createdAt: plan.createdAt, planId });
    this.#audit(who, 'application_role_assignment_planned', planId, input?.now, { status });
    return clone(plan);
  }

  reviewRoleAssignmentPlan(input) {
    const who = actor(input?.actor);
    assertTenantModuleEnabled(who.tenantId, 'application_roles');
    authorize(this.authorization, who, 'approve_role_assignment');
    const plan = this.#record(who.tenantId, 'roleAssignmentPlans', input?.planId, 'Unknown role assignment plan');
    if (plan.status !== 'pending_approval') throw new Error(`Role assignment plan ${plan.id} is already ${plan.status}`);
    const decision = String(input?.decision ?? '').trim().toLowerCase();
    if (!['approved', 'rejected'].includes(decision)) throw new Error('Role assignment decision must be approved or rejected');
    plan.status = decision;
    plan.approvedBy = who.userId;
    plan.approvedAt = iso(input?.now);
    plan.approvalReason = String(input?.reason ?? '').trim() || null;
    const submission = this.#record(who.tenantId, 'submissions', plan.submissionId, 'Unknown application submission');
    submission.history.push({ tenantId: who.tenantId, type: 'role_assignment_reviewed', actorId: who.userId, createdAt: plan.approvedAt, planId: plan.id, decision });
    this.#audit(who, 'application_role_assignment_reviewed', plan.id, input?.now, { decision });
    return clone(plan);
  }

  snapshot(tenantId) {
    const key = getTenantProfile(String(tenantId)).key;
    const tenant = this.#tenant(key);
    return Object.freeze({
      tenantId: key,
      definitions: Object.freeze([...tenant.definitions.values()].map(clone)),
      submissions: Object.freeze([...tenant.submissions.values()].map(clone)),
      verificationPanels: Object.freeze([...tenant.verificationPanels.values()].map(clone)),
      roleAssignmentPlans: Object.freeze([...tenant.roleAssignmentPlans.values()].map(clone)),
      auditTrail: Object.freeze([...tenant.auditTrail].map(clone)),
    });
  }

  #tenant(tenantId) {
    const key = getTenantProfile(String(tenantId)).key;
    if (!this.state.has(key)) {
      const definitions = new Map();
      for (const type of Object.values(DEFAULT_APPLICATION_TYPES)) {
        definitions.set(type.key, {
          typeKey: type.key,
          tenantId: key,
          label: type.label,
          enabled: true,
          questions: ['Why should we accept this application?'],
          updatedBy: 'system',
          updatedAt: iso('2026-01-01T00:00:00.000Z'),
        });
      }
      this.state.set(key, {
        definitions,
        submissions: new Map(),
        verificationPanels: new Map(),
        roleAssignmentPlans: new Map(),
        auditTrail: [],
      });
    }
    return this.state.get(key);
  }

  #definition(tenantId, typeKey) {
    const normalized = normalizeTypeKey(typeKey);
    const tenant = this.#tenant(tenantId);
    const record = tenant.definitions.get(normalized);
    if (!record) throw new Error(`Unknown application definition ${normalized} in tenant ${tenantId}`);
    return record;
  }

  #record(tenantId, collection, id, notFoundMessage) {
    const tenantKey = getTenantProfile(String(tenantId)).key;
    const tenant = this.#tenant(tenantKey);
    const record = tenant[collection].get(String(id));
    if (!record) {
      for (const [otherTenant, state] of this.state.entries()) {
        if (otherTenant === tenantKey) continue;
        if (state[collection].has(String(id))) throw new Error(`Cross-tenant access denied: ${tenantKey} -> ${otherTenant}`);
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

export function createApplicationsEngine(options) {
  return new ApplicationsEngine(options);
}

export { DEFAULT_APPLICATION_TYPES, DEFAULT_ACTION_ROLES };
