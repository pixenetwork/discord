import test from 'node:test';
import assert from 'node:assert/strict';
import { parseJsonBody } from '../src/webhook-body.mjs';

test('malformed webhook JSON fails closed', () => {
  const parsed = parseJsonBody(Buffer.from('{"id":', 'utf8'));

  assert.deepEqual(parsed, { ok: false, error: 'invalid_json' });
});

test('valid webhook JSON is returned for routing', () => {
  const parsed = parseJsonBody(Buffer.from('{"id":12345}', 'utf8'));

  assert.deepEqual(parsed, { ok: true, value: { id: 12345 } });
});
