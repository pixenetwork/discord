import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { publishAquapediaCards } from '../src/aquapedia-posts.mjs';

const queue = JSON.parse(readFileSync(new URL('../data/medaka-competition-cards.review.json', import.meta.url), 'utf8'));
const official = new Set(['jma-medaka.com', 'ima-medaka.or.jp', 'medakagachibattle.com', 'medakafest.com', 'en.cipscom.com']);

test('Medaka source-backed queue has nine distinct unapproved event summaries', () => {
  assert.equal(queue.sourceStatus, 'REVIEW_ONLY_UNAPPROVED_NOT_TO_PUBLISH');
  assert.equal(queue.status, 'pending_review');
  assert.equal(queue.discordPublicationApproved, false);
  assert.equal(queue.publicAudienceApproved, false);
  assert.equal(queue.publicMedakaResearch, true);
  assert.equal(queue.targetExistingForumId, '1561189286399705128');
  assert.equal(queue.cards.length, 9);
  assert.equal(queue.cards.reduce((sum, c) => sum + c.recordCount, 0), 63);
  assert.equal(new Set(queue.cards.map(c => c.id)).size, 9);
});

test('Medaka award queue rejects invented photo rights, unsupported websites, and source-only homepage links', () => {
  for (const card of queue.cards) {
    assert.match(card.id, /^medaka-awards-[a-z0-9-]+-20\d{2}$/);
    assert.equal(card.entityType, 'competition');
    assert.equal(card.organismGroup, 'medaka');
    assert.equal(card.websiteUrl, 'https://aquapedia.app/medakapedia/competitions/');
    assert.deepEqual(card.photos, []);
    assert.ok(card.message.length > 40 && card.message.length <= 1900);
    assert.ok(card.sources.some(value => {
      try {return official.has(new URL(value).hostname.replace(/^www\./, ''));} catch {return false;}
    }), card.id);
    assert.match(card.message, /not automatically genetic strain creators/);
  }
});

test('review queue is inert even if handed directly to the public publisher', async () => {
  const result = await publishAquapediaCards(null, queue);
  assert.equal(result.posted, 0);
  assert.equal(result.reason, 'review_or_completion_pending');
});
