import { requireVerifiedActor } from './discord-identity.mjs';
import { assertTenantBoundary, assertTenantModuleEnabled, getTenantProfile } from './tenants.mjs';

const DEFAULT_TICKET_TYPES = Object.freeze({
  standard: Object.freeze({ key: 'standard', label: 'Standard Support', moduleKey: 'tickets' }),
  enquiry: Object.freeze({ key: 'enquiry', label: 'General Enquiry', moduleKey: 'tickets' }),
  bug: Object.freeze({ key: 'bug', label: 'Bug Report', moduleKey: 'bug_reports' }),
  ban_appeal: Object.freeze({ key: 'ban_appeal', label: 'Ban Appeal', moduleKey: 'ban_appeals' }),
  staff_report: Object.freeze({ key: 'staff_report', label: 'Staff Report', moduleKey: 'staff_reports' }),
  tebex: Object.freeze({ key: 'tebex', label: 'Tebex Support', moduleKey: 'tebex_tickets' }),
});

const DEFAULT_ACTION_ROLES = Object.freeze({
  claim_ticket: Object.freeze(['staff']),
  unclaim_ticket: Object.freeze(['staff']),
  close_ticket: Object.freeze(['staff']),
  reopen_ticket: Object.freeze(['staff']),
  add_participant: Object.freeze(['staff']),
  remove_participant: Object.freeze(['staff']),
  schedule_reminder: Object.freeze(['staff']),
  resolve_reminder: Object.freeze(['staff']),
  close_request: Object.freeze(['staff']),
});

const CLOSED_STATUS = 'closed';

function normalizeTicketTypes(input = {}) {
  const merged = {};
  for (const [key, definition] of Object.entries(DEFAULT_TICKET_TYPES)) {
    const override = input[key] ?? {};
    const enabled = override.enabled !== false;
    const moduleKey = String(override.moduleKey ?? definition.moduleKey);
    merged[key] = Object.freeze({
      key,
      label: String(override.label ?? definition.label),
      moduleKey,
      enabled,
    });
  }
  return Object.freeze(merged);
}

function nowIso(now) {
  return new Date(now ?? Date.now()).toISOString();
}

function cloneRecord(record) {
  return JSON.parse(JSON.stringify(record));
}

function ensureActor(actor) {
  return requireVerifiedActor(actor, 'ticket actor');
}

function ensureTenant(tenantId) {
  return getTenantProfile(String(tenantId)).key;
}

function ensureTypeEnabled(ticketTypes, typeKey) {
  const type = ticketTypes[String(typeKey)];
  if (!type || !type.enabled) throw new Error(`Unsupported ticket type: ${typeKey}`);
  return type;
}

function ensureTenantAccess(actorTenantId, ticketTenantId) {
  assertTenantBoundary({ actorTenant: actorTenantId, targetTenant: ticketTenantId, actorIsOwner: false });
}

function getRolePolicy(authorization, tenantId, actionKey) {
  const tenantConfig = authorization?.[tenantId];
  if (!tenantConfig?.canonicalRoleIds || typeof tenantConfig.canonicalRoleIds !== 'object') {
    throw new Error(`Missing canonical role configuration for tenant ${tenantId}`);
  }
  const actionRoles = tenantConfig.actionRoles ?? DEFAULT_ACTION_ROLES;
  const requiredAliases = actionRoles[actionKey];
  if (!Array.isArray(requiredAliases) || !requiredAliases.length) {
    throw new Error(`Missing canonical role policy for action ${actionKey} in tenant ${tenantId}`);
  }
  const requiredRoleIds = requiredAliases
    .map((alias) => tenantConfig.canonicalRoleIds[String(alias)])
    .filter(Boolean)
    .map((roleId) => String(roleId));
  if (!requiredRoleIds.length) {
    throw new Error(`Missing canonical role IDs for action ${actionKey} in tenant ${tenantId}`);
  }
  return requiredRoleIds;
}

function authorize(authorization, actor, actionKey, ticket = null) {
  if (ticket && actionKey === 'close_request' && actor.userId === ticket.createdBy) {
    return true;
  }
  const requiredRoleIds = getRolePolicy(authorization, actor.tenantId, actionKey);
  if (!requiredRoleIds.some((roleId) => actor.roleIds.includes(roleId))) {
    throw new Error(`Authorization denied for ${actionKey} in tenant ${actor.tenantId}`);
  }
  return true;
}

function addHistory(ticket, eventType, actorId, details = {}, now) {
  ticket.history.push(Object.freeze({
    tenantId: ticket.tenantId,
    ticketId: ticket.id,
    type: eventType,
    actorId,
    createdAt: nowIso(now),
    ...details,
  }));
}

function ensureTicketOpen(ticket) {
  if (ticket.status === CLOSED_STATUS) throw new Error(`Ticket ${ticket.id} is closed`);
}

export class TicketEngine {
  constructor(options = {}) {
    this.ticketTypes = normalizeTicketTypes(options.ticketTypes);
    this.authorization = options.authorization ?? {};
    this.tickets = new Map();
    this.ticketCounter = 1;
    this.reminderCounter = 1;
  }

  createTicket(input) {
    const actor = ensureActor(input?.actor);
    const tenantId = ensureTenant(actor.tenantId);
    const type = ensureTypeEnabled(this.ticketTypes, input?.typeKey ?? 'standard');

    assertTenantModuleEnabled(tenantId, 'tickets');
    assertTenantModuleEnabled(tenantId, type.moduleKey);

    const id = `ticket_${this.ticketCounter++}`;
    const participants = [...new Set([actor.userId, ...(input?.participantIds ?? []).map((idValue) => String(idValue))])];
    const createdAt = nowIso(input?.now);

    const ticket = {
      id,
      tenantId,
      typeKey: type.key,
      subject: String(input?.subject ?? '').trim(),
      status: 'open',
      claimedBy: null,
      closeRequestedBy: null,
      closedAt: null,
      closedBy: null,
      createdBy: actor.userId,
      createdAt,
      updatedAt: createdAt,
      participants,
      metadata: { ...(input?.metadata ?? {}) },
      reminders: [],
      history: [],
    };

    addHistory(ticket, 'ticket_created', actor.userId, { typeKey: type.key }, input?.now);
    this.tickets.set(id, ticket);
    return cloneRecord(ticket);
  }

  getTicket(input) {
    const who = ensureActor(input?.actor);
    authorize(this.authorization, who, 'claim_ticket');
    const ticketId = String(input?.ticketId ?? '');
    const ticket = this.tickets.get(ticketId);
    if (!ticket) throw new Error(`Unknown ticket: ${ticketId}`);
    if (ticket.tenantId !== who.tenantId) throw new Error(`Cross-tenant access denied: ${who.tenantId} -> ${ticket.tenantId}`);
    return cloneRecord(ticket);
  }

  claimTicket(input) {
    const actor = ensureActor(input?.actor);
    const ticket = this.tickets.get(String(input?.ticketId));
    if (!ticket) throw new Error(`Unknown ticket: ${input?.ticketId}`);
    ensureTenantAccess(actor.tenantId, ticket.tenantId);
    ensureTicketOpen(ticket);
    authorize(this.authorization, actor, 'claim_ticket', ticket);

    if (ticket.claimedBy && ticket.claimedBy !== actor.userId) {
      throw new Error(`Ticket ${ticket.id} is already claimed by ${ticket.claimedBy}`);
    }

    ticket.claimedBy = actor.userId;
    ticket.updatedAt = nowIso(input?.now);
    addHistory(ticket, 'ticket_claimed', actor.userId, {}, input?.now);
    return cloneRecord(ticket);
  }

  unclaimTicket(input) {
    const actor = ensureActor(input?.actor);
    const ticket = this.tickets.get(String(input?.ticketId));
    if (!ticket) throw new Error(`Unknown ticket: ${input?.ticketId}`);
    ensureTenantAccess(actor.tenantId, ticket.tenantId);
    ensureTicketOpen(ticket);
    authorize(this.authorization, actor, 'unclaim_ticket', ticket);

    ticket.claimedBy = null;
    ticket.updatedAt = nowIso(input?.now);
    addHistory(ticket, 'ticket_unclaimed', actor.userId, {}, input?.now);
    return cloneRecord(ticket);
  }

  requestClose(input) {
    const actor = ensureActor(input?.actor);
    const ticket = this.tickets.get(String(input?.ticketId));
    if (!ticket) throw new Error(`Unknown ticket: ${input?.ticketId}`);
    ensureTenantAccess(actor.tenantId, ticket.tenantId);
    ensureTicketOpen(ticket);
    authorize(this.authorization, actor, 'close_request', ticket);

    ticket.status = 'close_requested';
    ticket.closeRequestedBy = actor.userId;
    ticket.updatedAt = nowIso(input?.now);
    addHistory(ticket, 'ticket_close_requested', actor.userId, { reason: input?.reason ?? null }, input?.now);
    return cloneRecord(ticket);
  }

  closeTicket(input) {
    const actor = ensureActor(input?.actor);
    const ticket = this.tickets.get(String(input?.ticketId));
    if (!ticket) throw new Error(`Unknown ticket: ${input?.ticketId}`);
    ensureTenantAccess(actor.tenantId, ticket.tenantId);
    authorize(this.authorization, actor, 'close_ticket', ticket);

    if (ticket.status === CLOSED_STATUS) return cloneRecord(ticket);

    ticket.status = CLOSED_STATUS;
    ticket.closedBy = actor.userId;
    ticket.closedAt = nowIso(input?.now);
    ticket.updatedAt = ticket.closedAt;
    addHistory(ticket, 'ticket_closed', actor.userId, { reason: input?.reason ?? null }, input?.now);
    return cloneRecord(ticket);
  }

  reopenTicket(input) {
    const actor = ensureActor(input?.actor);
    const ticket = this.tickets.get(String(input?.ticketId));
    if (!ticket) throw new Error(`Unknown ticket: ${input?.ticketId}`);
    ensureTenantAccess(actor.tenantId, ticket.tenantId);
    authorize(this.authorization, actor, 'reopen_ticket', ticket);

    if (ticket.status !== CLOSED_STATUS) throw new Error(`Ticket ${ticket.id} is not closed`);

    ticket.status = 'open';
    ticket.closeRequestedBy = null;
    ticket.closedBy = null;
    ticket.closedAt = null;
    ticket.updatedAt = nowIso(input?.now);
    addHistory(ticket, 'ticket_reopened', actor.userId, { reason: input?.reason ?? null }, input?.now);
    return cloneRecord(ticket);
  }

  addParticipant(input) {
    const actor = ensureActor(input?.actor);
    const ticket = this.tickets.get(String(input?.ticketId));
    if (!ticket) throw new Error(`Unknown ticket: ${input?.ticketId}`);
    ensureTenantAccess(actor.tenantId, ticket.tenantId);
    ensureTicketOpen(ticket);
    authorize(this.authorization, actor, 'add_participant', ticket);

    const participantId = String(input?.participantId ?? '');
    if (!participantId) throw new Error('participantId is required');
    if (!ticket.participants.includes(participantId)) {
      ticket.participants.push(participantId);
      ticket.updatedAt = nowIso(input?.now);
      addHistory(ticket, 'ticket_participant_added', actor.userId, { participantId }, input?.now);
    }
    return cloneRecord(ticket);
  }

  removeParticipant(input) {
    const actor = ensureActor(input?.actor);
    const ticket = this.tickets.get(String(input?.ticketId));
    if (!ticket) throw new Error(`Unknown ticket: ${input?.ticketId}`);
    ensureTenantAccess(actor.tenantId, ticket.tenantId);
    ensureTicketOpen(ticket);
    authorize(this.authorization, actor, 'remove_participant', ticket);

    const participantId = String(input?.participantId ?? '');
    if (!participantId) throw new Error('participantId is required');
    if (participantId === ticket.createdBy) {
      throw new Error('Cannot remove ticket creator from participants');
    }
    const nextParticipants = ticket.participants.filter((id) => id !== participantId);
    ticket.participants = nextParticipants;
    ticket.updatedAt = nowIso(input?.now);
    addHistory(ticket, 'ticket_participant_removed', actor.userId, { participantId }, input?.now);
    return cloneRecord(ticket);
  }

  scheduleReminder(input) {
    const actor = ensureActor(input?.actor);
    const ticket = this.tickets.get(String(input?.ticketId));
    if (!ticket) throw new Error(`Unknown ticket: ${input?.ticketId}`);
    ensureTenantAccess(actor.tenantId, ticket.tenantId);
    ensureTicketOpen(ticket);
    authorize(this.authorization, actor, 'schedule_reminder', ticket);
    assertTenantModuleEnabled(ticket.tenantId, 'ticket_reminders');

    const reminder = {
      id: `reminder_${this.reminderCounter++}`,
      tenantId: ticket.tenantId,
      ticketId: ticket.id,
      dueAt: nowIso(input?.dueAt),
      message: String(input?.message ?? '').trim(),
      createdBy: actor.userId,
      createdAt: nowIso(input?.now),
      resolvedAt: null,
      resolvedBy: null,
    };

    ticket.reminders.push(reminder);
    ticket.updatedAt = nowIso(input?.now);
    addHistory(ticket, 'ticket_reminder_scheduled', actor.userId, { reminderId: reminder.id }, input?.now);
    return cloneRecord(reminder);
  }

  resolveReminder(input) {
    const actor = ensureActor(input?.actor);
    const ticket = this.tickets.get(String(input?.ticketId));
    if (!ticket) throw new Error(`Unknown ticket: ${input?.ticketId}`);
    ensureTenantAccess(actor.tenantId, ticket.tenantId);
    authorize(this.authorization, actor, 'resolve_reminder', ticket);

    const reminder = ticket.reminders.find((record) => record.id === String(input?.reminderId));
    if (!reminder) throw new Error(`Unknown reminder: ${input?.reminderId}`);
    reminder.resolvedAt = nowIso(input?.now);
    reminder.resolvedBy = actor.userId;
    ticket.updatedAt = reminder.resolvedAt;
    addHistory(ticket, 'ticket_reminder_resolved', actor.userId, { reminderId: reminder.id }, input?.now);
    return cloneRecord(reminder);
  }

  dueReminders(input = {}) {
    const who = ensureActor(input?.actor);
    authorize(this.authorization, who, 'schedule_reminder');
    const tenantId = who.tenantId;
    const dueBefore = nowIso(input?.now);
    const reminders = [];
    for (const ticket of this.tickets.values()) {
      if (ticket.tenantId !== tenantId) continue;
      for (const reminder of ticket.reminders) {
        if (reminder.resolvedAt) continue;
        if (reminder.dueAt <= dueBefore) reminders.push(cloneRecord(reminder));
      }
    }
    return reminders;
  }

  transcriptMetadata(input) {
    const who = ensureActor(input?.actor);
    authorize(this.authorization, who, 'claim_ticket');
    const ticket = this.tickets.get(String(input?.ticketId));
    if (!ticket) throw new Error(`Unknown ticket: ${input?.ticketId}`);
    if (ticket.tenantId !== who.tenantId) throw new Error(`Cross-tenant access denied: ${who.tenantId} -> ${ticket.tenantId}`);
    assertTenantModuleEnabled(ticket.tenantId, 'ticket_transcripts');

    const reminderCreatedAt = ticket.reminders.length
      ? ticket.reminders.map((entry) => entry.createdAt).sort().at(-1)
      : null;

    return Object.freeze({
      tenantId: ticket.tenantId,
      ticketId: ticket.id,
      typeKey: ticket.typeKey,
      status: ticket.status,
      createdBy: ticket.createdBy,
      createdAt: ticket.createdAt,
      closedBy: ticket.closedBy,
      closedAt: ticket.closedAt,
      claimedBy: ticket.claimedBy,
      participantIds: Object.freeze([...ticket.participants]),
      participantCount: ticket.participants.length,
      closeRequestedBy: ticket.closeRequestedBy,
      historyCount: ticket.history.length,
      reminderCount: ticket.reminders.length,
      lastReminderCreatedAt: reminderCreatedAt,
      reminderIds: Object.freeze(ticket.reminders.map((entry) => entry.id)),
    });
  }
}

export function createTicketEngine(options) {
  return new TicketEngine(options);
}

export { DEFAULT_TICKET_TYPES, DEFAULT_ACTION_ROLES, normalizeTicketTypes };
