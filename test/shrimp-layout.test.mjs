import test from 'node:test';
import assert from 'node:assert/strict';
import { layoutDefinition } from '../src/layout.mjs';
import { RESEARCH_FORUMS, RESEARCH_CATEGORY } from '../src/canonical-research-forums.mjs';

test('general Aquapedia layout cannot re-create shrimp and arowana research forums', () => {
  const sections = layoutDefinition();
  const publicAquapedia = sections.filter(x => x.category === '📚・AQUAPEDIA');
  assert.equal(publicAquapedia.length, 1);
  assert.deepEqual((publicAquapedia[0].forums ?? []).map(f => f.name), ['🐠・guppy-research']);
  assert.equal(RESEARCH_CATEGORY.id, '1561430495680667719');
  assert.equal(RESEARCH_FORUMS.shrimp.id, '1561189288090140743');
  assert.equal(RESEARCH_FORUMS.arowana.id, '1561193084899819680');
});
