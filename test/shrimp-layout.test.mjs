import test from 'node:test';
import assert from 'node:assert/strict';
import { layoutDefinition } from '../src/layout.mjs';

test('the existing public Aquapedia category includes exactly one shared shrimp research forum', () => {
  const sections = layoutDefinition();
  const publicAquapedia = sections.filter(x => x.category === '📚・AQUAPEDIA');
  assert.equal(publicAquapedia.length, 1);
  const forums = publicAquapedia[0].forums ?? [];
  assert.deepEqual(forums.map(f => f.name), ['🦐・shrimp-research', '🐉・arowana-research']);
  assert.match(forums[1].topic, /source|evidence|research/i);
  assert.match(forums[0].topic, /breeder/i);
  assert.match(forums[0].topic, /competition/i);
  assert.equal(publicAquapedia[0].vendorOnly, undefined);
  assert.equal(publicAquapedia[0].staffOnly, undefined);
});
