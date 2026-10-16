import test from 'node:test';
import assert from 'node:assert/strict';
import { createResearchService } from '../src/research.mjs';

test('research job rejects a caller-supplied non-Discord requester ID before storage or external writes', async () => {
  const recorded = [];
  const service = createResearchService({
    jarvis: { researchEndpoint: null },
    aquapedia: { githubToken: null, repository: 'pixenetwork/aquapedia', branch:'main' },
    store: { async recordResearchJob(x) { recorded.push(x); } },
  });
  for (const badId of ['hacker\\n# Markdown header', 'user-1', '', undefined]) {
    await assert.rejects(() => service.research({
      entityType: 'breeder', name: 'Galactic Shrimps', requestedBy: badId,
    }), /Discord user ID/);
  }
  assert.equal(recorded.length, 0);
});
