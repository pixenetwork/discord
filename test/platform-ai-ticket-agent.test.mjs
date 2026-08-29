import test from 'node:test';
import assert from 'node:assert/strict';
import { createAiTicketAgentEngine, ISSUE_CLASSES } from '../src/platform/ai-ticket-agent.mjs';

const authorization = {
  beverly_hills_rp: {
    canonicalRoleIds: { staff: 'bh-staff', developer: 'bh-dev', owner: 'bh-owner' },
  },
  blood_diamond_rp: {
    canonicalRoleIds: { staff: 'bd-staff', developer: 'bd-dev', owner: 'bd-owner' },
  },
  customer_support: {
    canonicalRoleIds: { staff: 'support-staff', developer: 'support-dev', owner: 'support-owner' },
  },
  pixel_network_office: {
    canonicalRoleIds: { staff: 'office-staff' },
  },
};

const staff = (tenantId, roleId) => ({
  userId: `${tenantId}_staff`,
  tenantId,
  roleIds: [roleId],
});

const bhStaff = staff('beverly_hills_rp', 'bh-staff');
const bdStaff = staff('blood_diamond_rp', 'bd-staff');
const supportStaff = staff('customer_support', 'support-staff');

test('ingests structured ticket context without live Discord or model calls', () => {
  const engine = createAiTicketAgentEngine({ authorization });
  const ingested = engine.ingestContext({
    actor: bhStaff,
    ticketId: 'ticket_101',
    subject: 'Inventory wipe on reconnect',
    messages: [{ authorId: 'player_1', body: 'Lost all items after crash', createdAt: '2026-08-29T04:00:00.000Z' }],
    attachments: [{ name: 'crash.png', kind: 'image', contentType: 'image/png', textExcerpt: 'F8 console error' }],
    logs: [{ source: 'server.log', message: 'ox_inventory: failed to hydrate', level: 'error', observedAt: '2026-08-29T03:59:00.000Z' }],
    now: '2026-08-29T04:01:00.000Z',
  });

  assert.equal(ingested.tenantId, 'beverly_hills_rp');
  assert.equal(ingested.ticketId, 'ticket_101');
  assert.equal(ingested.attachments.length, 1);
  assert.equal(ingested.logs[0].source, 'server.log');
  assert.equal(ingested.likelyFix, null);
  assert.equal(engine.getCase('beverly_hills_rp', 'ticket_101').subject, 'Inventory wipe on reconnect');
});

test('records follow-ups, duplicates, staff summaries, classification, and suggested fixes', () => {
  const engine = createAiTicketAgentEngine({ authorization });
  engine.ingestContext({
    actor: supportStaff,
    ticketId: 'ticket_cs_1',
    subject: 'Script config mismatch',
    messages: [{ body: 'Doorlock not loading after restart' }],
  });

  const followUps = engine.recordFollowUpQuestions({
    actor: supportStaff,
    ticketId: 'ticket_cs_1',
    questions: [
      { text: 'Which resource version is installed?', reason: 'version drift' },
      'Did the cfg change after last restart?',
    ],
  });
  assert.equal(followUps.length, 2);
  assert.equal(followUps[0].tenantId, 'customer_support');

  const duplicate = engine.recordDuplicateDetection({
    actor: supportStaff,
    ticketId: 'ticket_cs_1',
    matchedTicketId: 'ticket_cs_0',
    similarity: 0.91,
    rationale: 'Same resource and restart window',
    signals: ['resource:doorlock', 'restart'],
  });
  assert.equal(duplicate.matchedTicketId, 'ticket_cs_0');
  assert.equal(duplicate.similarity, 0.91);

  const summary = engine.writeStaffSummary({
    actor: supportStaff,
    ticketId: 'ticket_cs_1',
    summary: 'Likely misconfigured doorlock ensure order after restart.',
    highlights: ['restart', 'doorlock'],
  });
  assert.match(summary.summary, /doorlock/);

  const classification = engine.classifyIssue({
    actor: supportStaff,
    ticketId: 'ticket_cs_1',
    classification: 'configuration_issue',
    confidence: 0.84,
    rationale: 'Ensure order mismatch in server.cfg excerpt',
  });
  assert.equal(classification.classification, 'configuration_issue');
  assert.ok(ISSUE_CLASSES.includes(classification.classification));

  const suggestion = engine.suggestLikelyFix({
    actor: supportStaff,
    ticketId: 'ticket_cs_1',
    suggestion: 'Move ensure doorlock above dependent housing resources',
    confidence: 0.77,
    evidence: [{ label: 'server.cfg excerpt', source: 'attachment:server.cfg', detail: 'ensure housing before doorlock' }],
  });
  assert.equal(suggestion.fixApplied, false);
  assert.equal(suggestion.toolConfirmation, null);
  assert.equal(suggestion.evidence.length, 1);
});

test('never claims a fix was applied unless toolConfirmation is present', () => {
  const engine = createAiTicketAgentEngine({ authorization });
  engine.ingestContext({
    actor: bhStaff,
    ticketId: 'ticket_fix',
    subject: 'Needs remediation',
    messages: [{ body: 'please fix' }],
  });

  const withoutConfirm = engine.suggestLikelyFix({
    actor: bhStaff,
    ticketId: 'ticket_fix',
    suggestion: 'Restart the resource after config sync',
    confidence: 0.6,
    evidence: [{ label: 'operator note', source: 'staff' }],
    // Explicit falsey claim must still stay false without tool confirmation.
    fixApplied: true,
  });
  assert.equal(withoutConfirm.fixApplied, false);

  const withConfirm = engine.suggestLikelyFix({
    actor: bhStaff,
    ticketId: 'ticket_fix',
    suggestion: 'Restart the resource after config sync',
    confidence: 0.6,
    evidence: [{ label: 'txAdmin action', source: 'tool:txadmin' }],
    toolConfirmation: { toolName: 'txadmin.restart_resource', confirmationId: 'txn_9', result: 'ok' },
  });
  assert.equal(withConfirm.fixApplied, true);
  assert.equal(withConfirm.toolConfirmation.confirmationId, 'txn_9');

  engine.suggestLikelyFix({
    actor: bhStaff,
    ticketId: 'ticket_fix',
    suggestion: 'Clear client cache then reconnect',
    confidence: 0.55,
    evidence: [{ label: 'playbook', source: 'knowledge_base' }],
  });
  const confirmedLater = engine.confirmToolAction({
    actor: bhStaff,
    ticketId: 'ticket_fix',
    toolConfirmation: { toolName: 'staff.cache_clear', confirmationId: 'ops_12' },
  });
  assert.equal(confirmedLater.fixApplied, true);
  assert.equal(confirmedLater.toolConfirmation.toolName, 'staff.cache_clear');
});

test('tenant isolation fails closed between Beverly Hills RP and Blood Diamond RP', () => {
  const engine = createAiTicketAgentEngine({ authorization });
  engine.ingestContext({
    actor: bhStaff,
    ticketId: 'shared_label',
    subject: 'BH only case',
    messages: [{ body: 'bh context' }],
  });

  assert.throws(() => engine.getCase('blood_diamond_rp', 'shared_label'), /Unknown AI ticket case/);
  assert.throws(() => engine.recordFollowUpQuestions({
    actor: bdStaff,
    ticketId: 'shared_label',
    questions: ['Can you reproduce on BD?'],
  }), /Unknown AI ticket case/);

  engine.ingestContext({
    actor: bdStaff,
    ticketId: 'shared_label',
    subject: 'BD only case',
    messages: [{ body: 'bd context' }],
  });
  assert.equal(engine.getCase('beverly_hills_rp', 'shared_label').subject, 'BH only case');
  assert.equal(engine.getCase('blood_diamond_rp', 'shared_label').subject, 'BD only case');
  assert.equal(engine.listCases('beverly_hills_rp').length, 1);
  assert.equal(engine.listCases('blood_diamond_rp').length, 1);
});

test('canonical-role authorization and disabled modules fail closed', () => {
  const engine = createAiTicketAgentEngine({ authorization });
  const lookalike = { userId: 'fake', tenantId: 'beverly_hills_rp', roleIds: ['Staff', 'bh-staff-lookalike'] };
  assert.throws(() => engine.ingestContext({
    actor: lookalike,
    ticketId: 't1',
    subject: 'nope',
    messages: [{ body: 'x' }],
  }), /Authorization denied/);

  assert.throws(() => engine.ingestContext({
    actor: staff('pixel_network_office', 'office-staff'),
    ticketId: 't2',
    subject: 'office should not run AI ticket agent',
    messages: [{ body: 'x' }],
  }), /disabled/);
});

test('ai_budget is enforced and privileged actions emit tenant-scoped audit events', () => {
  const engine = createAiTicketAgentEngine({ authorization });
  engine.configureBudget({
    actor: bhStaff,
    limitUnits: 2,
    usedUnits: 0,
    now: '2026-08-29T05:00:00.000Z',
  });

  engine.ingestContext({
    actor: bhStaff,
    ticketId: 'budget_ticket',
    subject: 'Budgeted triage',
    messages: [{ body: 'first' }],
    costUnits: 1,
    now: '2026-08-29T05:01:00.000Z',
  });
  engine.classifyIssue({
    actor: bhStaff,
    ticketId: 'budget_ticket',
    classification: 'player_issue',
    confidence: 0.5,
    costUnits: 1,
    now: '2026-08-29T05:02:00.000Z',
  });

  assert.throws(() => engine.writeStaffSummary({
    actor: bhStaff,
    ticketId: 'budget_ticket',
    summary: 'Would exceed budget',
    costUnits: 1,
  }), /AI budget exhausted/);

  const audits = engine.auditEvents('beverly_hills_rp');
  assert.ok(audits.some((event) => event.action === 'ai_budget_configured'));
  assert.ok(audits.some((event) => event.action === 'ai_ticket_context_ingested'));
  assert.ok(audits.some((event) => event.action === 'ai_ticket_classified'));
  assert.equal(engine.auditEvents('blood_diamond_rp').length, 0);
  assert.equal(engine.getBudget('beverly_hills_rp').usedUnits, 2);
});
