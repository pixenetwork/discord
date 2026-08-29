import test from 'node:test';
import assert from 'node:assert/strict';
import { createAiTicketAgentEngine, ISSUE_CLASSES } from '../src/platform/ai-ticket-agent.mjs';
import { bindActor, createTestIdentityAdapter } from './helpers/discord-identity-fixtures.mjs';

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

const identity = createTestIdentityAdapter();
const bhStaff = bindActor(identity, 'beverly_hills_rp', 'bh_staff', ['bh-staff']);
const bdStaff = bindActor(identity, 'blood_diamond_rp', 'bd_staff', ['bd-staff']);
const supportStaff = bindActor(identity, 'customer_support', 'support_staff', ['support-staff']);
const officeStaff = bindActor(identity, 'pixel_network_office', 'office_staff', ['office-staff']);

function engineWithBudget(actor = bhStaff, limitUnits = 100) {
  const engine = createAiTicketAgentEngine({ authorization });
  engine.configureBudget({ actor, limitUnits, usedUnits: 0 });
  return engine;
}

test('ingests structured ticket context without live Discord or model calls', () => {
  const engine = engineWithBudget(bhStaff);
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
  const engine = engineWithBudget(supportStaff);
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

test('suggestLikelyFix never sets fixApplied; only adapter-confirmed tool results do', () => {
  const engine = engineWithBudget(bhStaff);
  engine.ingestContext({
    actor: bhStaff,
    ticketId: 'ticket_fix',
    subject: 'Needs remediation',
    messages: [{ body: 'please fix' }],
  });

  const spoofed = engine.suggestLikelyFix({
    actor: bhStaff,
    ticketId: 'ticket_fix',
    suggestion: 'Restart the resource after config sync',
    confidence: 0.6,
    evidence: [{ label: 'txAdmin action', source: 'tool:txadmin' }],
    fixApplied: true,
    toolConfirmation: { toolName: 'txadmin.restart_resource', confirmationId: 'txn_9', result: 'ok' },
  });
  assert.equal(spoofed.fixApplied, false);
  assert.equal(spoofed.toolConfirmation, null);

  assert.throws(() => engine.confirmToolAction({
    actor: bhStaff,
    ticketId: 'ticket_fix',
    toolConfirmation: { toolName: 'txadmin.restart_resource', confirmationId: 'txn_9', result: 'ok' },
  }), /Unverified tool confirmation/);

  const sealed = identity.confirmToolResult({
    toolName: 'staff.cache_clear',
    confirmationId: 'ops_12',
    result: 'ok',
  });
  const confirmed = engine.confirmToolAction({
    actor: bhStaff,
    ticketId: 'ticket_fix',
    toolConfirmation: sealed,
  });
  assert.equal(confirmed.fixApplied, true);
  assert.equal(confirmed.toolConfirmation.toolName, 'staff.cache_clear');
});

test('missing AI budget fails closed for ingest and classify', () => {
  const engine = createAiTicketAgentEngine({ authorization });
  assert.throws(() => engine.ingestContext({
    actor: bhStaff,
    ticketId: 'no_budget',
    subject: 'Should fail',
    messages: [{ body: 'x' }],
  }), /AI budget not configured/);

  engine.configureBudget({ actor: bhStaff, limitUnits: 1, usedUnits: 0 });
  engine.ingestContext({
    actor: bhStaff,
    ticketId: 'budgeted',
    subject: 'ok',
    messages: [{ body: 'x' }],
    costUnits: 1,
  });
  assert.throws(() => engine.classifyIssue({
    actor: bhStaff,
    ticketId: 'budgeted',
    classification: 'player_issue',
    confidence: 0.4,
  }), /AI budget exhausted|AI budget not configured/);
});

test('tenant isolation fails closed between Beverly Hills RP and Blood Diamond RP', () => {
  const engine = createAiTicketAgentEngine({ authorization });
  engine.configureBudget({ actor: bhStaff, limitUnits: 10, usedUnits: 0 });
  engine.configureBudget({ actor: bdStaff, limitUnits: 10, usedUnits: 0 });
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
});

test('unverified spoofed actors and disabled modules fail closed', () => {
  const engine = engineWithBudget(bhStaff);
  const lookalike = { userId: 'fake', tenantId: 'beverly_hills_rp', roleIds: ['bh-staff'] };
  assert.throws(() => engine.ingestContext({
    actor: lookalike,
    ticketId: 't1',
    subject: 'nope',
    messages: [{ body: 'x' }],
  }), /Unverified Discord identity/);

  const lookalikeBound = bindActor(identity, 'beverly_hills_rp', 'fake', ['Staff', 'bh-staff-lookalike']);
  assert.throws(() => engine.ingestContext({
    actor: lookalikeBound,
    ticketId: 't1b',
    subject: 'nope',
    messages: [{ body: 'x' }],
  }), /Authorization denied/);

  assert.throws(() => engine.ingestContext({
    actor: officeStaff,
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
