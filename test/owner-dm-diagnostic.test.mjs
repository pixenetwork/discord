import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createOwnerDmDiagnostic, ownerDmDiagnosticCommand } from '../src/owner-dm-diagnostic.mjs';
import { createBreederInbox } from '../src/breeder-inbox.mjs';

const owner = '100000000000000001';
const stranger = '100000000000000002';
const medaka = '100000000000000003';
const msg = (authorId, content, extras = {}) => ({
  id: '200000000000000001', guildId: null,
  author: { id: authorId, bot: false }, content,
  async reply() { throw new Error('reply must be stubbed'); }, ...extras,
});

test('valid owner required, command can register in guild', () => {
  assert.throws(() => createOwnerDmDiagnostic({ ownerUserId: 'nope' }), /Valid owner/);
  assert.equal(ownerDmDiagnosticCommand().toJSON().name, 'aq-dm-test');
  assert.equal(ownerDmDiagnosticCommand().toJSON().default_member_permissions, '8'); // Administrator visibility restriction
});

test('DM diagnostic ignores other authors, bots, guild traffic, and unrelated text', async () => {
  let replies = 0;
  const diagnostic = createOwnerDmDiagnostic({ ownerUserId: owner });
  const reply = async () => { replies += 1; };
  assert.equal(await diagnostic.handleIncoming(msg(stranger, 'AQ-DM-TEST', { reply })), false);
  assert.equal(await diagnostic.handleIncoming(msg(owner, 'AQ-DM-TEST', { guildId: '123', reply })), false);
  assert.equal(await diagnostic.handleIncoming(msg(owner, 'AQ-DM-TEST', { author: { id: owner, bot: true }, reply })), false);
  assert.equal(await diagnostic.handleIncoming(msg(owner, 'interview details', { reply })), false);
  assert.equal(replies, 0);
});

test('owner exact DM probe acknowledges without using breeder recording', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'aq-dmtest-'));
  const statuses = [];
  const diagnostic = createOwnerDmDiagnostic({ ownerUserId: owner, onStatus: (...args) => statuses.push(args) });
  const breeder = createBreederInbox({ recipientIds: [medaka], outputDir: dir });
  const replies = [];
  try {
    const message = msg(owner, '  aq-dm-test  ', { reply: async (payload) => replies.push(payload) });
    const handled = await diagnostic.handleIncoming(message);
    if (!handled) await breeder(message);
    assert.equal(handled, true);
    assert.equal(replies.length, 1);
    assert.match(replies[0].content, /received and acknowledged/);
    assert.deepEqual(replies[0].allowedMentions, { parse: [], repliedUser: false });
    assert.deepEqual(statuses, [['OWNER_DM_INBOUND_ACK_OK']]);
    assert.deepEqual(await readdir(dir), []);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('failed owner DM reply reports only numeric Discord error', async () => {
  const statuses = [];
  const diagnostic = createOwnerDmDiagnostic({ ownerUserId: owner, onStatus: (...args) => statuses.push(args) });
  const caught = await diagnostic.handleIncoming(msg(owner, 'AQ-DM-TEST', {
    reply: async () => { throw Object.assign(new Error('sensitive error string'), { code: 50007 }); },
  }));
  assert.equal(caught, true);
  assert.deepEqual(statuses, [['OWNER_DM_INBOUND_ACK_FAILED', '50007']]);
});

function interaction(userId, { send, failure } = {}) {
  const calls = { sent: [], reply: [], defer: [], edit: [] };
  const i = {
    commandName: 'aq-dm-test',
    isChatInputCommand: () => true,
    user: { id: userId, async send(payload) { calls.sent.push(payload); if (failure) throw failure; if (send) await send(payload); } },
    async reply(payload) { calls.reply.push(payload); },
    async deferReply(payload) { calls.defer.push(payload); },
    async editReply(payload) { calls.edit.push(payload); },
  };
  return { i, calls };
}

test('slash diagnostic does not DM nonowners', async () => {
  const d = createOwnerDmDiagnostic({ ownerUserId: owner });
  const { i, calls } = interaction(stranger);
  assert.equal(await d.handleCommand(i), true);
  assert.equal(calls.sent.length, 0);
  assert.equal(calls.reply[0].ephemeral, true);
});

test('slash diagnostic sends ONLY to authenticated owner with ephemeral status', async () => {
  const statuses = [];
  const d = createOwnerDmDiagnostic({ ownerUserId: owner, onStatus: (...args) => statuses.push(args) });
  const { i, calls } = interaction(owner);
  assert.equal(await d.handleCommand(i), true);
  assert.equal(calls.defer[0].ephemeral, true);
  assert.equal(calls.sent.length, 1);
  assert.match(calls.sent[0].content, /AQ-DM-TEST/);
  assert.deepEqual(calls.sent[0].allowedMentions, { parse: [] });
  assert.match(calls.edit[0], /Discord accepted/);
  assert.deepEqual(statuses, [['OWNER_DM_OUTBOUND_ACCEPTED']]);
});

test('Discord DM failure 50007 is surfaced without throwing or disclosing message', async () => {
  const statuses = [];
  const d = createOwnerDmDiagnostic({ ownerUserId: owner, onStatus: (...args) => statuses.push(args) });
  const { i, calls } = interaction(owner, { failure: Object.assign(new Error('private diagnostic detail'), { code: 50007 }) });
  assert.equal(await d.handleCommand(i), true);
  assert.equal(calls.edit.length, 1);
  assert.match(calls.edit[0], /50007/);
  assert.doesNotMatch(calls.edit[0], /private diagnostic detail/);
  assert.deepEqual(statuses, [['OWNER_DM_OUTBOUND_FAILED', '50007']]);
});


test('guild command router advertises the owner DM test once', async () => {
  const { createCommandRouter } = await import('../src/commands.mjs');
  const definitions = createCommandRouter({}).definitions;
  assert.equal(definitions.filter((item) => item.name === 'aq-dm-test').length, 1);
});
