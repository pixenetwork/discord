import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ALL_MODULE_KEYS,
  MODULE_BY_KEY,
  approvalGatedModules,
  defaultModuleState,
  disableModule,
  enableModule,
  fullSuiteModuleState,
  validateModuleState,
} from '../src/platform/modules.mjs';

test('full suite contains every registered module and validates dependencies', () => {
  const state = validateModuleState(fullSuiteModuleState());
  assert.equal(Object.keys(state).length, ALL_MODULE_KEYS.length);
  assert.ok(ALL_MODULE_KEYS.length > 40);
  for (const key of ALL_MODULE_KEYS) assert.equal(state[key], true);
});

test('enabling a module enables its dependencies recursively', () => {
  const state = enableModule(defaultModuleState(), 'ban_appeals');
  assert.equal(state.ban_appeals, true);
  assert.equal(state.tickets, true);
  assert.equal(state.ban_evidence, true);
  assert.equal(state.retention, true);
  assert.equal(state.audit, true);
  assert.equal(state.rbac, true);
});

test('disabling a required dependency fails closed', () => {
  const state = enableModule(defaultModuleState(), 'ai_ticket_agent');
  assert.throws(() => disableModule(state, 'tickets'), /depend on it/);
});

test('high-impact controls stay marked approval-gated even in the full suite', () => {
  const gated = approvalGatedModules(fullSuiteModuleState());
  assert.ok(gated.includes('mass_unban'));
  assert.ok(gated.includes('restart_control'));
  assert.ok(gated.includes('backups'));
  assert.equal(MODULE_BY_KEY.mass_unban.risk, 'high');
  assert.equal(MODULE_BY_KEY.restart_control.risk, 'high');
});

test('unknown module settings are rejected', () => {
  assert.throws(() => validateModuleState({ ...defaultModuleState(), definitely_not_real: true }), /Unknown Discord module/);
});
