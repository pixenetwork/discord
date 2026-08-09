import test from 'node:test';
import assert from 'node:assert/strict';
import { createHandoffEngine } from '../src/platform/handoffs.mjs';

const authorization = {
  customer_support: { canonicalRoleIds: { staff: 'support-staff', developer: 'support-dev', owner: 'support-owner' } },
  beverly_hills_rp: { canonicalRoleIds: { staff: 'bh-staff', developer: 'bh-dev', owner: 'bh-owner' } },
};

const supportStaff = { userId: 'staff', tenantId: 'customer_support', roleIds: ['support-staff'] };

test('approved GitHub issue link is tenant scoped and idempotent', () => {
  const engine = createHandoffEngine({ authorization, allowedRepositories: ['pixenetwork/discord'] });
  const input = { actor: supportStaff, sourceType: 'ticket', sourceId: 'ticket-1', repository: 'pixenetwork/discord', issueNumber: 2 };
  const first = engine.linkGitHubIssue(input);
  const duplicate = engine.linkGitHubIssue(input);
  assert.deepEqual(duplicate, first);
  assert.equal(engine.get('customer_support', 'ticket', 'ticket-1').issueNumber, 2);
  assert.throws(() => engine.get('beverly_hills_rp', 'ticket', 'ticket-1'), /No engineering handoff/);
});

test('unapproved repositories and conflicting relinks fail closed', () => {
  const engine = createHandoffEngine({ authorization, allowedRepositories: ['pixenetwork/discord'] });
  assert.throws(() => engine.linkGitHubIssue({ actor: supportStaff, sourceType: 'ticket', sourceId: '1', repository: 'someone/else', issueNumber: 1 }), /not approved/);
  engine.linkGitHubIssue({ actor: supportStaff, sourceType: 'ticket', sourceId: '2', repository: 'pixenetwork/discord', issueNumber: 2 });
  assert.throws(() => engine.linkGitHubIssue({ actor: supportStaff, sourceType: 'ticket', sourceId: '2', repository: 'pixenetwork/discord', issueNumber: 3 }), /already linked/);
});

test('resolution updates record state only and require canonical authorization', () => {
  const engine = createHandoffEngine({ authorization, allowedRepositories: ['pixenetwork/discord'] });
  engine.linkGitHubIssue({ actor: supportStaff, sourceType: 'ticket', sourceId: '3', repository: 'pixenetwork/discord', issueNumber: 4 });
  const updated = engine.updateResolution({ actor: supportStaff, sourceType: 'ticket', sourceId: '3', status: 'resolved', resolutionSummary: 'Fixed in reviewed change' });
  assert.equal(updated.status, 'resolved');
  assert.equal(updated.resolutionSummary, 'Fixed in reviewed change');

  const lookalike = { userId: 'fake', tenantId: 'customer_support', roleIds: ['Pixel Staff'] };
  assert.throws(() => engine.linkGitHubIssue({ actor: lookalike, sourceType: 'ticket', sourceId: '4', repository: 'pixenetwork/discord', issueNumber: 5 }), /Authorization denied/);
});
