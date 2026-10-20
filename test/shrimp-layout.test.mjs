import test from 'node:test';
import assert from 'node:assert/strict';
import { layoutDefinition } from '../src/layout.mjs';

test('public shrimp research stays in the canonical species category', () => {
  const sections = layoutDefinition();
  const intro = sections.find(x => x.category === '📚・AQUAPEDIA');
  const species = sections.find(x => x.category === '🧬・AQUAPEDIA — SPECIES & GENETICS');
  const magazines = sections.find(x => x.category === '📰・AQUAPEDIA — MAGAZINES & ARTICLES');
  assert.equal(intro.forums, undefined);
  assert.equal(species.forums.length, 6);
  assert.equal(magazines.forums.length, 5);
  assert.equal(new Set(species.forums.map(x => x.name)).size, 6);
  const shrimp = species.forums.filter(f => f.name === '🦐・shrimp-research');
  assert.equal(shrimp.length, 1);
  assert.equal(shrimp[0].id, '1561189288090140743');
  assert.match(shrimp[0].topic,/Caridina/);
  assert.deepEqual(shrimp[0].tags.map(t=>t.name),['Breeder','Strain','Competition','Lineage','Genetics','Husbandry']);
  assert.equal(shrimp[0].protectExisting,true);
});
