// Offline, credential-free preflight. Never sends Discord messages.
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { prepareShrimpPublicBatch } from '../src/shrimp-public-batch.mjs';
import { buildAquapediaPost } from '../src/aquapedia-posts.mjs';

const [breederFile, contestFile] = process.argv.slice(2);
if (!breederFile || !contestFile) throw new Error('Pass breeder and contest manifest paths');
const breederManifest = JSON.parse(readFileSync(breederFile, 'utf8'));
const contestManifest = JSON.parse(readFileSync(contestFile, 'utf8'));
const batch = prepareShrimpPublicBatch({ breederManifest, contestManifest });
assert.equal(batch.cards.length, 22);
assert.equal(batch.discordPublicationApproved, false);
assert.equal(batch.publicAudienceApproved, false);
let maxContent = 0;
for (const card of batch.cards) {
  const payload = buildAquapediaPost(card);
  assert.equal(payload.allowedMentions.parse.length, 0);
  assert.ok(payload.content.length <= 1900);
  assert.ok(payload.embeds[0].footer.text.includes(card.id.slice(0,70)));
  assert.ok(!payload.embeds.some(e => e.image));
  assert.ok(payload.embeds[0].fields.every(f => f.value.length <= 1024));
  maxContent = Math.max(maxContent, payload.content.length);
}
console.log(JSON.stringify({
  valid: true, staged: batch.cards.length,
  breeders: batch.cards.filter(c => c.entityType === 'breeder').length,
  contests: batch.cards.filter(c => c.entityType === 'competition').length,
  maxMessageChars: maxContent, authorization: 'CLOSED',
}));
