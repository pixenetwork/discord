import test from 'node:test';
import assert from 'node:assert/strict';
import { authorizePrivateBreederCards } from '../src/breeder-forum-authorization.mjs';
import { signedBreederFixture } from './helpers/breeder-auth-fixture.mjs';

function guild() {
  const category = { id: 'private-category', type: 4, name: '🔬・BREEDER RESEARCH' };
  const secondCategory = { id: 'private-category-2', type: 4, name: '🔬・BREEDER RESEARCH II' };
  const wang = { id: 'forum-wang', parentId: category.id, type: 15, name: 'wang-xin-jiangyu' };
  const tarumi = { id: 'forum-tarumi', parentId: secondCategory.id, type: 15, name: 'tarumi-medaka' };
  const kondo = { id: 'forum-kondo', parentId: secondCategory.id, type: 15, name: 'Kondo-Toshitsugu-近藤利継' };
  return { id: 'test-guild', channels: { cache: new Map([
    ['c1', category], ['c2', secondCategory], ['wang', wang], ['tarumi', tarumi], ['kondo', kondo],
  ]) } };
}
function publication(cards) {
  return { status: 'completed', discordPublicationApproved: true, cards };
}
async function check(fixture) {
  return authorizePrivateBreederCards(fixture.guild, fixture.result,
    fixture.result.cards, fixture.authority);
}

test('wrong breeder-to-forum association is denied without claiming a receipt', async () => {
  const f = signedBreederFixture(guild(), publication([
    { id: 'strain-1', entityType: 'strain', breederName: 'Wang Xin', breederForumName: 'tarumi-medaka' },
  ]));
  assert.deepEqual(await check(f), { ok: false, reason: 'forum_binding_not_authorized' });
  assert.equal(f.getClaimed(), false);
});

test('verified Japanese and romaji aliases resolve to exact approved existing forum', async () => {
  const f = signedBreederFixture(guild(), publication([
    { id: 'strain-2', entityType: 'strain', breederName: '近藤利継', breederForumName: 'Kondo-Toshitsugu-近藤利継' },
    { id: 'strain-3', entityType: 'strain', breederName: 'Kondo Toshitsugu', breederForumName: 'Kondo-Toshitsugu-近藤利継' },
  ]));
  const checked = await check(f);
  assert.equal(checked.ok, true);
  assert.equal(checked.approvedForumsByCard.get(f.result.cards[0]).name, 'Kondo-Toshitsugu-近藤利継');
  assert.equal(checked.approvedForumsByCard.get(f.result.cards[1]).name, 'Kondo-Toshitsugu-近藤利継');
  assert.equal(f.getClaimed(), true);
});

test('explicit unauthorized forum name never falls back to derived breeder slug', async () => {
  const f = signedBreederFixture(guild(), publication([
    { id: 'strain-4', entityType: 'strain', breederName: 'Wang Xin', breederForumName: 'nonexistent-forum' },
  ]));
  assert.equal((await check(f)).reason, 'forum_binding_not_authorized');
  assert.equal(f.getClaimed(), false);
});

test('a changed card after signing invalidates the batch review receipt', async () => {
  const f = signedBreederFixture(guild(), publication([
    { id: 'strain-5', entityType: 'strain', breederName: 'Wang Xin', breederForumName: 'wang-xin-jiangyu' },
  ]));
  f.result.cards[0].name = 'Tampered card';
  assert.equal((await check(f)).reason, 'review_receipt_invalid');
});

test('expired signed review receipt is denied', async () => {
  const f = signedBreederFixture(guild(), publication([{ id: 'strain-6',
    entityType: 'strain', breederName: 'Wang Xin', breederForumName: 'wang-xin-jiangyu' }]), {
    receiptTransform: (r) => ({
      ...r, issuedAt: new Date(0).toISOString(), expiresAt: new Date(1000).toISOString(),
    }),
  });
  assert.equal((await check(f)).reason, 'review_receipt_invalid');
});

test('second use of same signed receipt fails atomic one-use claim', async () => {
  const f = signedBreederFixture(guild(), publication([
    { id: 'strain-7', entityType: 'strain', breederName: 'Wang Xin', breederForumName: 'wang-xin-jiangyu' },
  ]));
  assert.equal((await check(f)).ok, true);
  assert.equal((await check(f)).reason, 'review_receipt_replayed_or_unavailable');
});

test('changing forum ID or parent category denies before receipt claim', async () => {
  const f = signedBreederFixture(guild(), publication([
    { id: 'strain-8', entityType: 'strain', breederName: 'Wang Xin', breederForumName: 'wang-xin-jiangyu' },
  ]));
  f.guild.channels.cache.get('wang').id = 'replaced-forum';
  assert.equal((await check(f)).reason, 'forum_binding_not_authorized');
  assert.equal(f.getClaimed(), false);
});

test('missing external authority denies all private breeder publication', async () => {
  const f = signedBreederFixture(guild(), publication([
    { id: 'strain-9', entityType: 'strain', breederName: 'Wang Xin', breederForumName: 'wang-xin-jiangyu' },
  ]));
  assert.equal((await authorizePrivateBreederCards(f.guild, f.result, f.result.cards, null)).reason,
    'breeder_binding_authority_unavailable');
});

test('unsigned or substituted allowlist is rejected', async () => {
  const g = guild();
  const r = publication([{ id: 'strain-10', entityType: 'strain',
    breederName: 'Wang Xin', breederForumName: 'wang-xin-jiangyu' }]);
  const f = signedBreederFixture(g, r, { allowlistEnvelope: {
    payload: { guildId: g.id, bindings: [], issuedAt: new Date(0).toISOString() },
    signature: 'invalid',
  } });
  assert.equal((await check(f)).reason, 'breeder_allowlist_invalid');
});
