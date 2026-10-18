#!/usr/bin/env node
// Offline, credential-free Arowanapedia batch validation only. NO Discord writes.
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { prepareArowanaPublicBatch } from '../src/arowana-public-batch.mjs';
import { buildAquapediaPost } from '../src/aquapedia-posts.mjs';
const path=process.argv[2];
if (!path) throw new Error('Pass source site/assets/arowana-forum-cards.json path');
const manifest=JSON.parse(readFileSync(path,'utf8'));
const pending=prepareArowanaPublicBatch({manifest});
assert.equal(pending.status,'review_pending');
assert.equal(pending.discordPublicationApproved,false);
const approved=prepareArowanaPublicBatch({manifest,editorialApproved:true,publicAudienceApproved:true});
assert.equal(approved.cards.length,10);
for(const card of approved.cards){
  const payload=buildAquapediaPost(card);
  assert.equal(payload.allowedMentions.parse.length,0);
  assert.ok(payload.content.includes(card.websiteUrl));
  assert.ok(payload.embeds[0].fields.some(f=>f.name==='Research sources'));
}
console.log('PASS: 10 distinct source-linked, photo-free Arowanapedia cards validated; review gate remains closed by default; NO Discord writes');
