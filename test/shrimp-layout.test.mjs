import test from 'node:test';
import assert from 'node:assert/strict';
import { layoutDefinition } from '../src/layout.mjs';

test('the existing public Aquapedia category includes exactly one shared shrimp research forum', () => {
  const sections = layoutDefinition();
  const publicAquapedia = sections.filter(x => x.category === '📚・AQUAPEDIA');
  assert.equal(publicAquapedia.length, 1);
  const forums = publicAquapedia[0].forums ?? [];
  // New public magazine forums coexist with—not replace—the three research forums.
  assert.equal(new Set(forums.map(f => f.name)).size, forums.length, 'unique public forum names');
  const researchForums = forums.filter(f => f.name.endsWith('-research'));
  assert.deepEqual(researchForums.map(f => f.name), [
    '🐟・medaka-research', '🦐・shrimp-research', '🐉・arowana-research',
  ]);
  assert.match(researchForums[0].topic, /breeder|strain/i);
  assert.match(researchForums[0].topic, /evidence/i);
  assert.match(researchForums[1].topic, /breeder/i);
  assert.match(researchForums[1].topic, /competition/i);
  assert.match(researchForums[2].topic, /source|evidence|research/i);
  assert.deepEqual(forums.filter(f => !f.name.endsWith('-research')).map(f => f.name), [
    'magazines-and-articles',
    '📖・medaka-hyakka',
    '📘・medaka-advance',
    '🦐・shrimp-club',
    '🐟・medaka-trip',
  ]);
  assert.equal(publicAquapedia[0].vendorOnly, undefined);
  assert.equal(publicAquapedia[0].staffOnly, undefined);
});
