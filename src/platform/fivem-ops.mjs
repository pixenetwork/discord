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
  const who = requireVerifiedActor(input, 'FiveM actor');
  const profile = getTenantProfile(who.tenantId);
  if (profile.scope !== 'fivem-server') throw new Error(`Tenant ${who.tenantId} is not a FiveM server profile`);
  return who;
}

function authorize(authorization, who, aliases = ['staff']) {
  const canonical = authorization?.[who.tenantId]?.canonicalRoleIds;
  if (!canonical) throw new Error(`Missing canonical role configuration for tenant ${who.tenantId}`);
  const allowed = aliases.map((alias) => canonical[alias]).filter(Boolean).map(String);
  if (!allowed.length) throw new Error(`Missing canonical FiveM role IDs for tenant ${who.tenantId}`);
  if (!allowed.some((roleId) => who.roleIds.includes(roleId))) throw new Error(`Authorization denied for FiveM operation in tenant ${who.tenantId}`);
}

function key(tenantId, id) {
  return `${tenantId}:${id}`;
}

export class FiveMOpsEngine {
  constructor(options = {}) {
    this.authorization = options.authorization ?? {};
    this.status = new Map();
    this.restartNotices = new Map();
    this.statChannels = new Map();
    this.banCases = new Map();
    this.sits = new Map();
    this.duty = new Map();
    this.incidents = new Map();
    this.restartPlans = new Map();
    this.counters = { restart: 1, ban: 1, sit: 1, incident: 1, plan: 1 };
  }

  updateServerStatus(input) {
    const who = actor(input?.actor);
    assertTenantModuleEnabled(who.tenantId, 'fivem_status');
    authorize(this.authorization, who, ['staff', 'integration']);
    const status = String(input?.status ?? 'unknown').toLowerCase();
    if (!['online', 'offline', 'restarting', 'degraded', 'unknown'].includes(status)) throw new Error(`Unsupported server status: ${status}`);
    const players = Number(input?.players ?? 0);
    const maxPlayers = Number(input?.maxPlayers ?? 0);
    const queue = Number(input?.queue ?? 0);
    if (![players, maxPlayers, queue].every(Number.isInteger) || players < 0 || maxPlayers < 0 || queue < 0) throw new Error('players, maxPlayers, and queue must be non-negative integers');
    const record = {
      tenantId: who.tenantId,
      status,
      players,
      maxPlayers,
      queue,
      endpointLabel: String(input?.endpointLabel ?? '').trim() || null,
      observedAt: iso(input?.observedAt ?? input?.now),
      updatedBy: who.userId,
    };
    this.status.set(who.tenantId, record);
    return clone(record);
  }

  getServerStatus(input) {
    const who = actor(input?.actor);
    authorize(this.authorization, who, ['staff', 'integration']);
    assertTenantModuleEnabled(who.tenantId, 'fivem_status');
    return clone(this.status.get(who.tenantId) ?? { tenantId: who.tenantId, status: 'unknown', players: 0, maxPlayers: 0, queue: 0, observedAt: null });
  }

  recordRestartNotice(input) {
    const who = actor(input?.actor);
    assertTenantModuleEnabled(who.tenantId, 'txadmin_restarts');
    authorize(this.authorization, who, ['staff', 'integration']);
    const scheduledFor = iso(input?.scheduledFor);
    const record = {
      id: `restart_${this.counters.restart++}`,
      tenantId: who.tenantId,
      source: String(input?.source ?? 'txadmin'),
      scheduledFor,
      reason: String(input?.reason ?? '').trim() || null,
      countdownMinutes: Number.isInteger(input?.countdownMinutes) && input.countdownMinutes >= 0 ? input.countdownMinutes : null,
      createdAt: iso(input?.now),
      createdBy: who.userId,
    };
    this.restartNotices.set(key(who.tenantId, record.id), record);
    return clone(record);
  }

  setStatisticChannelState(input) {
    const who = actor(input?.actor);
    assertTenantModuleEnabled(who.tenantId, 'server_stat_channels');
    authorize(this.authorization, who, ['staff', 'integration']);
    const channelKey = String(input?.channelKey ?? '').trim();
    if (!channelKey) throw new Error('channelKey is required');
    const record = {
      tenantId: who.tenantId,
      channelKey,
      desiredName: String(input?.desiredName ?? '').trim(),
      value: String(input?.value ?? '').trim(),
      updatedAt: iso(input?.now),
      updatedBy: who.userId,
    };
    this.statChannels.set(key(who.tenantId, channelKey), record);
    return clone(record);
  }

  createBanEvidenceCase(input) {
    const who = actor(input?.actor);
    assertTenantModuleEnabled(who.tenantId, 'ban_evidence');
    authorize(this.authorization, who, ['staff']);
    const banRef = String(input?.banRef ?? '').trim();
    if (!banRef) throw new Error('banRef is required');
    const record = {
      id: `ban_case_${this.counters.ban++}`,
      tenantId: who.tenantId,
      banRef,
      subjectId: String(input?.subjectId ?? '').trim() || null,
      reason: String(input?.reason ?? '').trim() || null,
      evidence: [],
      timeline: [],
      createdAt: iso(input?.now),
      createdBy: who.userId,
    };
    record.timeline.push({ tenantId: who.tenantId, type: 'case_created', actorId: who.userId, createdAt: record.createdAt });
    this.banCases.set(key(who.tenantId, record.id), record);
    return clone(record);
  }

  addBanEvidence(input) {
    const who = actor(input?.actor);
    assertTenantModuleEnabled(who.tenantId, 'ban_evidence');
    authorize(this.authorization, who, ['staff']);
    const record = this.banCases.get(key(who.tenantId, String(input?.caseId)));
    if (!record) throw new Error(`Unknown ban evidence case ${input?.caseId} in tenant ${who.tenantId}`);
    const evidence = {
      id: `evidence_${record.evidence.length + 1}`,
      tenantId: who.tenantId,
      kind: String(input?.kind ?? 'note'),
      reference: String(input?.reference ?? '').trim(),
      summary: String(input?.summary ?? '').trim() || null,
      addedBy: who.userId,
      addedAt: iso(input?.now),
    };
    if (!evidence.reference) throw new Error('Evidence reference is required');
    record.evidence.push(evidence);
    record.timeline.push({ tenantId: who.tenantId, type: 'evidence_added', actorId: who.userId, createdAt: evidence.addedAt, evidenceId: evidence.id });
    return clone(evidence);
  }

  recordSit(input) {
    const who = actor(input?.actor);
    assertTenantModuleEnabled(who.tenantId, 'sits_tracker');
    authorize(this.authorization, who, ['staff']);
    const record = {
      id: `sit_${this.counters.sit++}`,
      tenantId: who.tenantId,
      staffUserId: String(input?.staffUserId ?? who.userId),
      subjectId: String(input?.subjectId ?? '').trim() || null,
      category: String(input?.category ?? 'general'),
      outcome: String(input?.outcome ?? '').trim() || null,
      startedAt: iso(input?.startedAt ?? input?.now),
      endedAt: input?.endedAt ? iso(input.endedAt) : null,
      recordedBy: who.userId,
    };
    this.sits.set(key(who.tenantId, record.id), record);
    return clone(record);
  }

  setDuty(input) {
    const who = actor(input?.actor);
    assertTenantModuleEnabled(who.tenantId, 'staff_duty');
    authorize(this.authorization, who, ['staff']);
    const staffUserId = String(input?.staffUserId ?? who.userId);
    const current = this.duty.get(key(who.tenantId, staffUserId));
    const onDuty = Boolean(input?.onDuty);
    const record = {
      tenantId: who.tenantId,
      staffUserId,
      onDuty,
      shiftStartedAt: onDuty ? (current?.onDuty ? current.shiftStartedAt : iso(input?.now)) : null,
      lastChangedAt: iso(input?.now),
      changedBy: who.userId,
    };
    this.duty.set(key(who.tenantId, staffUserId), record);
    return clone(record);
  }

  createIncident(input) {
    const who = actor(input?.actor);
    assertTenantModuleEnabled(who.tenantId, 'incident_command');
    authorize(this.authorization, who, ['staff']);
    const title = String(input?.title ?? '').trim();
    if (!title) throw new Error('Incident title is required');
    const createdAt = iso(input?.now);
    const record = {
      id: `incident_${this.counters.incident++}`,
      tenantId: who.tenantId,
      title,
      severity: ['low', 'medium', 'high', 'critical'].includes(input?.severity) ? input.severity : 'medium',
      status: 'open',
      ownerUserId: String(input?.ownerUserId ?? who.userId),
      affectedResources: [...new Set((input?.affectedResources ?? []).map(String).filter(Boolean))],
      timeline: [{ tenantId: who.tenantId, type: 'incident_opened', actorId: who.userId, createdAt }],
      createdAt,
      closedAt: null,
      postmortem: null,
    };
    this.incidents.set(key(who.tenantId, record.id), record);
    return clone(record);
  }

  addIncidentEvent(input) {
    const who = actor(input?.actor);
    assertTenantModuleEnabled(who.tenantId, 'incident_command');
    authorize(this.authorization, who, ['staff']);
    const incident = this.incidents.get(key(who.tenantId, String(input?.incidentId)));
    if (!incident) throw new Error(`Unknown incident ${input?.incidentId} in tenant ${who.tenantId}`);
    if (incident.status === 'closed') throw new Error(`Incident ${incident.id} is closed`);
    const event = {
      tenantId: who.tenantId,
      type: String(input?.type ?? 'note'),
      actorId: who.userId,
      createdAt: iso(input?.now),
      summary: String(input?.summary ?? '').trim() || null,
    };
    incident.timeline.push(event);
    return clone(event);
  }

  closeIncident(input) {
    const who = actor(input?.actor);
    assertTenantModuleEnabled(who.tenantId, 'incident_command');
    authorize(this.authorization, who, ['staff']);
    const incident = this.incidents.get(key(who.tenantId, String(input?.incidentId)));
    if (!incident) throw new Error(`Unknown incident ${input?.incidentId} in tenant ${who.tenantId}`);
    if (incident.status === 'closed') return clone(incident);
    incident.status = 'closed';
    incident.closedAt = iso(input?.now);
    incident.postmortem = String(input?.postmortem ?? '').trim() || null;
    incident.timeline.push({ tenantId: who.tenantId, type: 'incident_closed', actorId: who.userId, createdAt: incident.closedAt });
    return clone(incident);
  }

  planProductionRestart(input) {
    const who = actor(input?.actor);
    assertTenantModuleEnabled(who.tenantId, 'restart_control');
    authorize(this.authorization, who, ['staff', 'owner']);
    const record = {
      id: `restart_plan_${this.counters.plan++}`,
      tenantId: who.tenantId,
      reason: String(input?.reason ?? '').trim() || null,
      requestedBy: who.userId,
      requestedAt: iso(input?.now),
      approvalId: String(input?.approvalId ?? '').trim() || null,
      executionDisabled: true,
      status: 'planned_only',
    };
    this.restartPlans.set(key(who.tenantId, record.id), record);
    return clone(record);
  }

  listTenantIncidents(input) {
    const who = actor(input?.actor);
    authorize(this.authorization, who);
    assertTenantModuleEnabled(who.tenantId, 'incident_command');
    return [...this.incidents.values()].filter((record) => record.tenantId === who.tenantId).map(clone);
  }
}

export function createFiveMOpsEngine(options) {
  return new FiveMOpsEngine(options);
}
