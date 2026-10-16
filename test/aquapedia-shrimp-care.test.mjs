import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAquapediaPost } from '../src/aquapedia-posts.mjs';

test('shrimp breeder cards do not default to medaka care guidance', () => {
  const payload = buildAquapediaPost({ entityType: 'breeder', id: 'skyfish', name: 'Skyfish', organismGroup: 'shrimp', taxon: 'Caridina sp.', sources: ['https://skyfish-aqua.com/'] });
  const care = payload.embeds[0].fields.find((f) => f.name === 'Care notes').value;
  assert.doesNotMatch(care, /medaka/i);
  assert.match(care, /shrimp/i);
});
