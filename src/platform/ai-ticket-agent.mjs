import { requireVerifiedActor, requireVerifiedToolConfirmation } from './discord-identity.mjs';
import { assertTenantModuleEnabled } from './tenants.mjs';

const ISSUE_CLASSES = Object.freeze(['player_issue', 'script_bug', 'configuration_issue']);
const PRIVILEGED_ALIASES = Object.freeze(['staff', 'developer', 'owner']);

function iso(value = Date.now()) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error('A valid timestamp is required');
  return date.toISOString();
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function actor(input) {
  return requireVerifiedActor(input, 'AI ticket agent actor');
}

function authorize(authorization, who) {
  const canonical = authorization?.[who.tenantId]?.canonicalRoleIds;
  if (!canonical) throw new Error(`Missing canonical role configuration for tenant ${who.tenantId}`);
  if (!Array.isArray(who.roleIds) || who.roleIds.length === 0) {
    throw new Error(`Authorization denied for AI ticket agent in tenant ${who.tenantId}`);
  }
  const allowed = PRIVILEGED_ALIASES.map((alias) => canonical[alias]).filter(Boolean).map(String);
  if (!allowed.length) throw new Error(`Missing canonical AI ticket agent role IDs for tenant ${who.tenantId}`);
  if (!allowed.some((roleId) => who.roleIds.includes(roleId))) {
    throw new Error(`Authorization denied for AI ticket agent in tenant ${who.tenantId}`);
  }
}

function caseKey(tenantId, ticketId) {
  return `${tenantId}:${ticketId}`;
}

function normalizeAttachments(input = []) {
  if (!Array.isArray(input)) throw new Error('attachments must be an array of structured records');
  return input.map((entry, index) => {
    const name = String(entry?.name ?? entry?.filename ?? '').trim();
    const kind = String(entry?.kind ?? entry?.type ?? 'file').trim() || 'file';
    if (!name) throw new Error(`attachments[${index}].name is required`);
    return Object.freeze({
      name,
      kind,
      contentType: String(entry?.contentType ?? '').trim() || null,
      sha256: String(entry?.sha256 ?? '').trim() || null,
      textExcerpt: String(entry?.textExcerpt ?? '').trim() || null,
    });
  });
}

function normalizeLogs(input = []) {
  if (!Array.isArray(input)) throw new Error('logs must be an array of structured records');
  return input.map((entry, index) => {
    const source = String(entry?.source ?? '').trim();
    const message = String(entry?.message ?? entry?.line ?? '').trim();
    if (!source || !message) throw new Error(`logs[${index}] requires source and message`);
    return Object.freeze({
      source,
      message,
      level: String(entry?.level ?? 'info').trim().toLowerCase(),
      observedAt: entry?.observedAt ? iso(entry.observedAt) : null,
    });
  });
}

function normalizeEvidence(input = []) {
  if (!Array.isArray(input)) throw new Error('evidence must be an array');
  return input.map((entry, index) => {
    const label = String(entry?.label ?? entry?.summary ?? '').trim();
    const source = String(entry?.source ?? '').trim();
    if (!label || !source) throw new Error(`evidence[${index}] requires label and source`);
    return Object.freeze({
      label,
      source,
      detail: String(entry?.detail ?? '').trim() || null,
    });
  });
}

function ensureConfidence(value) {
  const confidence = Number(value);
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
    throw new Error('confidence must be a number between 0 and 1 inclusive');
  }
  return confidence;
}

function ensureUnits(value, label) {
  const units = Number(value);
  if (!Number.isSafeInteger(units) || units < 0) throw new Error(`${label} must be a non-negative safe integer`);
  return units;
}

/**
 * Domain-state engine for Jarvis AI ticket triage.
 * Accepts structured ticket context only — no Discord fetches and no live LLM/network calls.
 */
export class AiTicketAgentEngine {
  constructor(options = {}) {
    this.authorization = options.authorization ?? {};
    this.cases = new Map();
    this.budgets = new Map();
    this.auditByTenant = new Map();
    this.usedToolNonces = new Set();
    this.counters = { case: 1, followUp: 1, duplicate: 1, audit: 1 };
  }

  configureBudget(input) {
    const who = actor(input?.actor);
    this.#requireModules(who.tenantId);
    authorize(this.authorization, who);
    const limitUnits = ensureUnits(input?.limitUnits ?? 0, 'limitUnits');
    const usedUnits = ensureUnits(input?.usedUnits ?? 0, 'usedUnits');
    if (usedUnits > limitUnits) throw new Error('usedUnits cannot exceed limitUnits');
    const record = {
      tenantId: who.tenantId,
      limitUnits,
      usedUnits,
      updatedBy: who.userId,
      updatedAt: iso(input?.now),
    };
    this.budgets.set(who.tenantId, record);
    this.#audit(who, 'ai_budget_configured', who.tenantId, input?.now, { limitUnits, usedUnits });
    return clone(record);
  }

  getBudget(input) {
    const who = actor(input?.actor);
    assertTenantModuleEnabled(who.tenantId, 'ai_budget');
    authorize(this.authorization, who);
    const record = this.budgets.get(who.tenantId);
    if (!record) {
      return Object.freeze({ tenantId: who.tenantId, limitUnits: 0, usedUnits: 0, updatedBy: null, updatedAt: null });
    }
    return clone(record);
  }

  /**
   * Store structured ticket context / attachments / logs provided by the caller.
   * Does not fetch Discord messages, attachments, or remote logs.
   */
  ingestContext(input) {
    const who = actor(input?.actor);
    this.#requireModules(who.tenantId);
    authorize(this.authorization, who);
    const ticketId = String(input?.ticketId ?? '').trim();
    if (!ticketId) throw new Error('ticketId is required');
    const subject = String(input?.subject ?? '').trim();
    if (!subject) throw new Error('subject is required');
    this.#consumeBudget(who.tenantId, input?.costUnits ?? 1, input?.now);

    const record = this.#case(who.tenantId, ticketId, true);
    record.subject = subject;
    record.messages = Object.freeze(
      (Array.isArray(input?.messages) ? input.messages : []).map((entry) => Object.freeze({
        authorId: String(entry?.authorId ?? '').trim() || null,
        body: String(entry?.body ?? entry?.content ?? '').trim(),
        createdAt: entry?.createdAt ? iso(entry.createdAt) : null,
      })).filter((entry) => entry.body),
    );
    record.attachments = Object.freeze(normalizeAttachments(input?.attachments ?? []));
    record.logs = Object.freeze(normalizeLogs(input?.logs ?? []));
    record.contextIngestedAt = iso(input?.now);
    record.contextIngestedBy = who.userId;
    record.updatedAt = record.contextIngestedAt;
    this.#audit(who, 'ai_ticket_context_ingested', record.id, input?.now, {
      ticketId,
      attachmentCount: record.attachments.length,
      logCount: record.logs.length,
    });
    return clone(record);
  }

  recordFollowUpQuestions(input) {
    const who = actor(input?.actor);
    this.#requireModules(who.tenantId);
    authorize(this.authorization, who);
    const ticketId = String(input?.ticketId ?? '').trim();
    const questions = Array.isArray(input?.questions) ? input.questions : null;
    if (!ticketId) throw new Error('ticketId is required');
    if (!questions?.length) throw new Error('questions must be a non-empty array');
    this.#consumeBudget(who.tenantId, input?.costUnits ?? 1, input?.now);

    const record = this.#case(who.tenantId, ticketId);
    const createdAt = iso(input?.now);
    const entries = questions.map((question) => {
      const text = String(question?.text ?? question ?? '').trim();
      if (!text) throw new Error('follow-up question text is required');
      return Object.freeze({
        id: `followup_${this.counters.followUp++}`,
        tenantId: who.tenantId,
        ticketId,
        text,
        reason: String(question?.reason ?? '').trim() || null,
        createdBy: who.userId,
        createdAt,
        answeredAt: null,
        answer: null,
      });
    });
    record.followUps.push(...entries);
    record.updatedAt = createdAt;
    this.#audit(who, 'ai_ticket_followups_recorded', record.id, input?.now, {
      ticketId,
      count: entries.length,
    });
    return clone(entries);
  }

  recordDuplicateDetection(input) {
    const who = actor(input?.actor);
    this.#requireModules(who.tenantId);
    authorize(this.authorization, who);
    const ticketId = String(input?.ticketId ?? '').trim();
    const matchedTicketId = String(input?.matchedTicketId ?? '').trim();
    if (!ticketId || !matchedTicketId) throw new Error('ticketId and matchedTicketId are required');
    if (ticketId === matchedTicketId) throw new Error('matchedTicketId must differ from ticketId');
    this.#consumeBudget(who.tenantId, input?.costUnits ?? 1, input?.now);

    const record = this.#case(who.tenantId, ticketId);
    const detection = {
      id: `dup_${this.counters.duplicate++}`,
      tenantId: who.tenantId,
      ticketId,
      matchedTicketId,
      similarity: ensureConfidence(input?.similarity ?? input?.confidence ?? 0),
      rationale: String(input?.rationale ?? '').trim() || null,
      signals: Object.freeze([...(input?.signals ?? [])].map(String).map((value) => value.trim()).filter(Boolean)),
      createdBy: who.userId,
      createdAt: iso(input?.now),
    };
    record.duplicateDetections.push(detection);
    record.updatedAt = detection.createdAt;
    this.#audit(who, 'ai_ticket_duplicate_detected', record.id, input?.now, {
      ticketId,
      matchedTicketId,
      similarity: detection.similarity,
    });
    return clone(detection);
  }

  writeStaffSummary(input) {
    const who = actor(input?.actor);
    this.#requireModules(who.tenantId);
    authorize(this.authorization, who);
    const ticketId = String(input?.ticketId ?? '').trim();
    const summary = String(input?.summary ?? '').trim();
    if (!ticketId) throw new Error('ticketId is required');
    if (!summary) throw new Error('summary is required');
    this.#consumeBudget(who.tenantId, input?.costUnits ?? 1, input?.now);

    const record = this.#case(who.tenantId, ticketId);
    record.staffSummary = {
      tenantId: who.tenantId,
      ticketId,
      summary,
      highlights: Object.freeze([...(input?.highlights ?? [])].map(String).map((value) => value.trim()).filter(Boolean)),
      writtenBy: who.userId,
      writtenAt: iso(input?.now),
    };
    record.updatedAt = record.staffSummary.writtenAt;
    this.#audit(who, 'ai_ticket_staff_summary_written', record.id, input?.now, { ticketId });
    return clone(record.staffSummary);
  }

  classifyIssue(input) {
    const who = actor(input?.actor);
    this.#requireModules(who.tenantId);
    authorize(this.authorization, who);
    const ticketId = String(input?.ticketId ?? '').trim();
    const classification = String(input?.classification ?? '').trim().toLowerCase();
    if (!ticketId) throw new Error('ticketId is required');
    if (!ISSUE_CLASSES.includes(classification)) {
      throw new Error(`classification must be one of: ${ISSUE_CLASSES.join(', ')}`);
    }
    this.#consumeBudget(who.tenantId, input?.costUnits ?? 1, input?.now);

    const record = this.#case(who.tenantId, ticketId);
    record.classification = {
      tenantId: who.tenantId,
      ticketId,
      classification,
      confidence: ensureConfidence(input?.confidence ?? 0),
      rationale: String(input?.rationale ?? '').trim() || null,
      classifiedBy: who.userId,
      classifiedAt: iso(input?.now),
    };
    record.updatedAt = record.classification.classifiedAt;
    this.#audit(who, 'ai_ticket_classified', record.id, input?.now, { ticketId, classification });
    return clone(record.classification);
  }

  suggestLikelyFix(input) {
    const who = actor(input?.actor);
    this.#requireModules(who.tenantId);
    authorize(this.authorization, who);
    const ticketId = String(input?.ticketId ?? '').trim();
    const suggestion = String(input?.suggestion ?? input?.likelyFix ?? '').trim();
    if (!ticketId) throw new Error('ticketId is required');
    if (!suggestion) throw new Error('suggestion is required');
    this.#consumeBudget(who.tenantId, input?.costUnits ?? 1, input?.now);

    const record = this.#case(who.tenantId, ticketId);
    const action = String(input?.action ?? 'apply_likely_fix').trim() || 'apply_likely_fix';
    record.likelyFix = {
      tenantId: who.tenantId,
      ticketId,
      action,
      suggestion,
      confidence: ensureConfidence(input?.confidence ?? 0),
      evidence: Object.freeze(normalizeEvidence(input?.evidence ?? [])),
      // Suggestions never claim a fix was applied — ignore any caller toolConfirmation.
      fixApplied: false,
      toolConfirmation: null,
      suggestedBy: who.userId,
      suggestedAt: iso(input?.now),
    };
    record.updatedAt = record.likelyFix.suggestedAt;
    this.#audit(who, 'ai_ticket_fix_suggested', record.id, input?.now, {
      ticketId,
      action,
      fixApplied: false,
      confidence: record.likelyFix.confidence,
    });
    return clone(record.likelyFix);
  }

  /**
   * Record that an adapter-confirmed tool result applied a remediation.
   * Only sealed tool confirmations (tenant/action/ticket-bound, single-use nonce) may set fixApplied.
   */
  confirmToolAction(input) {
    const who = actor(input?.actor);
    this.#requireModules(who.tenantId);
    authorize(this.authorization, who);
    const ticketId = String(input?.ticketId ?? '').trim();
    if (!ticketId) throw new Error('ticketId is required');
    const sealed = requireVerifiedToolConfirmation(input?.toolConfirmation);
    if (!sealed.tenantId) throw new Error('Verified tool confirmation is missing tenantId bind');
    if (!sealed.action) throw new Error('Verified tool confirmation is missing action bind');
    if (!sealed.ticketId) throw new Error('Verified tool confirmation is missing ticketId bind');
    if (String(sealed.tenantId) !== who.tenantId) {
      throw new Error(`Tool confirmation tenant bind mismatch: ${sealed.tenantId} != ${who.tenantId}`);
    }
    if (String(sealed.ticketId) !== ticketId) {
      throw new Error(`Tool confirmation ticket bind mismatch: ${sealed.ticketId} != ${ticketId}`);
    }
    const nonce = String(sealed.nonce ?? '').trim();
    if (!nonce) throw new Error('Verified tool confirmation is missing nonce');
    if (input?.nonce != null && String(input.nonce) !== nonce) {
      throw new Error('Tool confirmation nonce does not match the sealed confirmation');
    }
    if (this.usedToolNonces.has(nonce)) {
      throw new Error(`Tool confirmation nonce already consumed: ${nonce}`);
    }
    if (!sealed.createdAt) throw new Error('Verified tool confirmation is missing createdAt');

    const record = this.#case(who.tenantId, ticketId);
    if (!record.likelyFix) throw new Error(`No likely fix suggestion exists for ticket ${ticketId}`);
    const expectedAction = String(input?.action ?? record.likelyFix.action ?? '').trim();
    if (!expectedAction) throw new Error('action is required to confirm a likely fix');
    if (String(sealed.action) !== expectedAction) {
      throw new Error(`Tool confirmation action bind mismatch: ${sealed.action} != ${expectedAction}`);
    }
    if (record.likelyFix.action && String(record.likelyFix.action) !== expectedAction) {
      throw new Error(`Likely fix action mismatch: ${record.likelyFix.action} != ${expectedAction}`);
    }

    const toolConfirmation = Object.freeze({
      toolName: sealed.toolName,
      confirmationId: sealed.confirmationId,
      tenantId: sealed.tenantId,
      action: sealed.action,
      ticketId: sealed.ticketId,
      nonce,
      createdAt: sealed.createdAt,
      result: sealed.result ?? null,
    });

    this.usedToolNonces.add(nonce);
    record.likelyFix.toolConfirmation = toolConfirmation;
    record.likelyFix.fixApplied = true;
    record.likelyFix.confirmedBy = who.userId;
    record.likelyFix.confirmedAt = iso(input?.now);
    record.updatedAt = record.likelyFix.confirmedAt;
    this.#audit(who, 'ai_ticket_fix_tool_confirmed', record.id, input?.now, {
      ticketId,
      action: sealed.action,
      toolName: toolConfirmation.toolName,
      confirmationId: toolConfirmation.confirmationId,
      nonce,
    });
    return clone(record.likelyFix);
  }

  getCase(input) {
    const who = actor(input?.actor);
    this.#requireModules(who.tenantId);
    authorize(this.authorization, who);
    const ticketId = String(input?.ticketId ?? '').trim();
    if (!ticketId) throw new Error('ticketId is required');
    const record = this.cases.get(caseKey(who.tenantId, ticketId));
    if (!record) throw new Error(`Unknown AI ticket case ${ticketId} in tenant ${who.tenantId}`);
    return clone(record);
  }

  listCases(input) {
    const who = actor(input?.actor);
    this.#requireModules(who.tenantId);
    authorize(this.authorization, who);
    return [...this.cases.values()]
      .filter((record) => record.tenantId === who.tenantId)
      .map(clone);
  }

  auditEvents(input) {
    const who = actor(input?.actor);
    assertTenantModuleEnabled(who.tenantId, 'audit');
    authorize(this.authorization, who);
    return clone(this.auditByTenant.get(who.tenantId) ?? []);
  }

  #requireModules(tenantId) {
    assertTenantModuleEnabled(tenantId, 'ai_ticket_agent');
    assertTenantModuleEnabled(tenantId, 'ai_budget');
    assertTenantModuleEnabled(tenantId, 'audit');
    assertTenantModuleEnabled(tenantId, 'tickets');
  }

  #consumeBudget(tenantId, costUnits, now) {
    const cost = ensureUnits(costUnits ?? 1, 'costUnits');
    const budget = this.budgets.get(tenantId);
    if (!budget) throw new Error(`AI budget not configured for tenant ${tenantId}`);
    if (cost === 0) return;
    if (budget.usedUnits + cost > budget.limitUnits) {
      throw new Error(`AI budget exhausted for tenant ${tenantId}`);
    }
    budget.usedUnits += cost;
    budget.updatedAt = iso(now);
  }

  #case(tenantId, ticketId, create = false) {
    const key = caseKey(tenantId, ticketId);
    let record = this.cases.get(key);
    if (!record) {
      if (!create) throw new Error(`Unknown AI ticket case ${ticketId} in tenant ${tenantId}`);
      record = {
        id: `ai_case_${this.counters.case++}`,
        tenantId,
        ticketId,
        subject: null,
        messages: Object.freeze([]),
        attachments: Object.freeze([]),
        logs: Object.freeze([]),
        followUps: [],
        duplicateDetections: [],
        staffSummary: null,
        classification: null,
        likelyFix: null,
        contextIngestedAt: null,
        contextIngestedBy: null,
        createdAt: iso(),
        updatedAt: iso(),
      };
      this.cases.set(key, record);
    }
    return record;
  }

  #audit(who, action, entityId, now, details = {}) {
    const event = {
      id: `audit_${this.counters.audit++}`,
      tenantId: who.tenantId,
      action,
      entityId,
      actorId: who.userId,
      createdAt: iso(now),
      ...details,
    };
    if (!this.auditByTenant.has(who.tenantId)) this.auditByTenant.set(who.tenantId, []);
    this.auditByTenant.get(who.tenantId).push(event);
    return event;
  }
}

export function createAiTicketAgentEngine(options) {
  return new AiTicketAgentEngine(options);
}

export { ISSUE_CLASSES, PRIVILEGED_ALIASES };
