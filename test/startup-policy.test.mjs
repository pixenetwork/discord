import test from 'node:test';
import assert from 'node:assert/strict';
import { startupPolicy } from '../src/startup-policy.mjs';
import { loadConfig } from '../src/config.mjs';

test('prelaunch mode suppresses Aquaphoria branding and command publication', () => {
  assert.deepEqual(startupPolicy({ prelaunch: true }), {
    provisionTranslatedForum: false,
    registerGuildCommands: false,
    registerGpt: false,
  });
});

test('normal mode publishes the Aquaphoria startup surfaces', () => {
  assert.deepEqual(startupPolicy({ prelaunch: false }), {
    provisionTranslatedForum: true,
    registerGuildCommands: true,
    registerGpt: true,
  });
});

test('runtime config parses AQUAPHORIA_PRELAUNCH without changing the default', () => {
  assert.equal(loadConfig({ AQUAPHORIA_PRELAUNCH: 'true' }).runtime.prelaunch, true);
  assert.equal(loadConfig({}).runtime.prelaunch, false);
});
