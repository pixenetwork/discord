import test from 'node:test';
import assert from 'node:assert/strict';
import { finalizeStaticAquapediaCard } from '../src/aquapedia-static-card.mjs';

function fixture({ archived = false, messages = null, failArchive = false, locked = false } = {}) {
  const calls = [];
  const record = { id: 'thread-1', name: 'STRAIN — Aurora',
    parentId: 'forum-1', archived, locked, appliedTags: ['strain-tag'] };
  let fail = failArchive;
  const msg = { id: 'message-1', author: { id: 'bot-1' },
    content: '**Aurora**\nhttps://aquapedia.app/medakapedia/strains/aurora/\n[AQUAPEDIA-PUBLIC-LINK:abc123abc123abc123]' };
  const rows = messages ?? [msg];
  const thread = {
    get id() { return record.id; },
    get parentId() { return record.parentId; },
    get name() { return record.name; },
    get archived() { return record.archived; },
    get locked() { return record.locked; },
    get appliedTags() { return record.appliedTags; },
    messages: {
      async fetch() { calls.push('fetch_messages'); return new Map(rows.map(m => [m.id,m])); }
    },
    async fetch() { calls.push('fetch_thread'); return this; },
    async setArchived(state) {
      calls.push('set_archived:' + state);
      if (fail) { fail = false; throw Error('temporary Discord API failure'); }
      record.archived = state;
      return this;
    }
  };
  const forum = {
    id: 'forum-1', parentId: 'category-public', type: 15,
    permissionsFor(role) {
      return { has(bit) { return role.id === 'everyone' && !!bit; } };
    }
  };
  const guild = { roles: { everyone: { id: 'everyone' } } };
  const receipts = [];
  const persistReceipt = async r => { calls.push('persist_receipt'); receipts.push(structuredClone(r)); };
  const opts = { guild, forum, thread, botUserId: 'bot-1',
    sourceUrl: 'https://aquapedia.app/medakapedia/strains/aurora/',
    marker: '[AQUAPEDIA-PUBLIC-LINK:abc123abc123abc123]',
    expectedMessageId: 'message-1', receiptId: 'aquapedia:aurora',
    publicCategoryId: 'category-public', strainTagId: 'strain-tag',
    persistReceipt
  };
  return { calls, record, receipts, opts, thread };
}

test('writes a durable verified receipt BEFORE archiving a single-message bot-owned public static card', async () => {
  const f = fixture();
  const result = await finalizeStaticAquapediaCard(f.opts);
  assert.equal(result.archived, true);
  assert.equal(result.verified, true);
  assert.equal(f.record.archived, true);
  assert.ok(f.calls.indexOf('persist_receipt') < f.calls.indexOf('set_archived:true'));
  assert.equal(f.receipts[0].status,'verified_unarchived');
  assert.equal(f.receipts.at(-1).status,'archived_verified');
});

test('archive failure preserves unarchived receipt and retry does not create or edit a card', async () => {
  const f = fixture({failArchive:true});
  await assert.rejects(() => finalizeStaticAquapediaCard(f.opts), /temporary Discord API failure/);
  assert.equal(f.record.archived, false);
  assert.equal(f.receipts.at(-1).status, 'verified_unarchived');
  const done = await finalizeStaticAquapediaCard(f.opts);
  assert.equal(done.archived,true);
  assert.deepEqual(f.calls.filter(x => x.startsWith('set_archived')),['set_archived:true','set_archived:true']);
  assert.equal(f.receipts.at(-1).status,'archived_verified');
});

test('never archives conversations, private forums, locked threads or untrusted message authors', async () => {
  for (const which of ['discussion','private','locked','author','parent','source','tag']) {
    const f = fixture();
    if (which==='discussion') f.opts.thread.messages.fetch = async () => new Map([['a',{}],['b',{}]]);
    if (which==='private') f.opts.forum.permissionsFor = () => ({has:()=>false});
    if (which==='locked') f.record.locked = true;
    if (which==='author') f.opts.thread.messages.fetch = async () => new Map([['a',{id:'message-1',author:{id:'other'},content:'[AQUAPEDIA-PUBLIC-LINK:abc123abc123abc123]'}]]);
    if (which==='parent') f.opts.forum.parentId = 'private-category';
    if (which==='source') f.opts.sourceUrl = 'https://example.com/a';
    if (which==='tag') f.record.appliedTags = ['other-tag'];
    await assert.rejects(() => finalizeStaticAquapediaCard(f.opts),undefined,which);
    assert.equal(f.calls.some(x=>x.startsWith('set_archived')),false,which);
    assert.equal(f.receipts.length,0,which);
  }
});

test('already archived verified card yields idempotent receipt without reopening', async () => {
  const f = fixture({archived:true});
  const result = await finalizeStaticAquapediaCard(f.opts);
  assert.equal(result.archived,true);
  assert.equal(f.calls.some(x=>x==='set_archived:false'),false);
  assert.equal(f.receipts.at(-1).status,'archived_verified');
});

test('fail closed when durable receipt writer is not present', async () => {
  const f=fixture();delete f.opts.persistReceipt;
  await assert.rejects(() => finalizeStaticAquapediaCard(f.opts),/receipt/i);
  assert.equal(f.record.archived,false);
});
