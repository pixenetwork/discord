import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAquapediaPost } from '../src/aquapedia-posts.mjs';

test('long Japanese source links are split without chopping Markdown targets', () => {
  const urls = Array.from({ length: 5 }, (_, i) =>
    'https://example.org/2026/09/25/' + '%e3%83%9e'.repeat(18) + '/source-' + i + '/');
  const payload = buildAquapediaPost({
    id: 'harugiku-radiare', entityType: 'strain', name: 'Harugiku Radiare',
    sources: urls, photos: [],
  });
  const fields = payload.embeds[0].fields.filter(({ name }) => name.startsWith('Research sources'));
  const rendered = fields.map(({ value }) => value).join(' ');
  assert.ok(fields.length > 1);
  for (let i = 0; i < urls.length; i++) assert.ok(rendered.includes(`[${i + 1}](${urls[i]})`));
  assert.ok(fields.every(({ value }) => value.length <= 430));
  assert.equal(payload.embeds[0].image, undefined);
});

test('source URLs too long for safe unbroken display fail closed', () => {
  assert.throws(() => buildAquapediaPost({
    entityType: 'strain', name: 'Example',
    sources: ['https://example.org/' + 'x'.repeat(450)],
  }), /safe embed field limit/);
});
