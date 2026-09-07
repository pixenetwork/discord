import test from 'node:test';
import assert from 'node:assert/strict';
import * as commands from '../src/commands.mjs';

test('Discord runtime command entrypoints used by index are exported', () => {
  assert.equal(typeof commands.registerGuildCommands, 'function');
  assert.equal(typeof commands.handleInteraction, 'function');
});
