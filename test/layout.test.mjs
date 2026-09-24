import test from 'node:test';
import assert from 'node:assert/strict';

import { layoutDefinition, publicationTagDefinitions } from '../src/layout.mjs';

test('Aquapedia layout includes translated-publications forum', () => {
  const layout = layoutDefinition();
  const section = layout.find((entry) => entry.category === '🔬・AQUAPEDIA RESEARCH');
  assert.ok(section);
  const forum = section.forums?.find((entry) => entry.name === '📚・translated-publications');
  assert.ok(forum);
  assert.match(forum.topic, /source, issue, year, and provenance/i);
});

test('translated-publications forum exposes bounded research tags', () => {
  const tags = publicationTagDefinitions();
  const names = tags.map((tag) => tag.name);
  assert.ok(names.includes('Japanese'));
  assert.ok(names.includes('Magazine'));
  assert.ok(names.includes('Official JMA'));
  assert.ok(names.includes('Kagami'));
  assert.ok(names.includes('Ryurin'));
  assert.ok(names.includes('Dragon Scale'));
  assert.ok(names.length <= 20);
  assert.equal(new Set(names).size, names.length);
});
