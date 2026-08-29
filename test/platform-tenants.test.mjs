import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TENANT_PROFILES,
  assertTenantBoundary,
  assertTenantModuleEnabled,
  canFormerStaffAccess,
  clearTenantModuleOverrides,
  enableTenantModule,
} from '../src/platform/tenants.mjs';

test('Beverly Hills RP and Blood Diamond RP have the full suite enabled independently', () => {
  assert.equal(TENANT_PROFILES.beverly_hills_rp.modules.ai_ticket_agent, true);
  assert.equal(TENANT_PROFILES.blood_diamond_rp.modules.ai_ticket_agent, true);
  assert.equal(TENANT_PROFILES.beverly_hills_rp.modules.gang_manager, true);
  assert.equal(TENANT_PROFILES.blood_diamond_rp.modules.gang_manager, true);
  assert.equal(TENANT_PROFILES.beverly_hills_rp.modules.restart_control, false);
  assert.equal(TENANT_PROFILES.beverly_hills_rp.modules.mass_unban, false);
  assert.equal(TENANT_PROFILES.blood_diamond_rp.modules.restart_control, false);
  assert.equal(TENANT_PROFILES.blood_diamond_rp.modules.mass_unban, false);
});

test('cross-server access fails closed for non-owner actors', () => {
  assert.throws(() => assertTenantBoundary({
    actorTenant: 'beverly_hills_rp',
    targetTenant: 'blood_diamond_rp',
    actorIsOwner: false,
  }), /Cross-tenant access denied/);
});

test('owner may explicitly cross tenant boundaries', () => {
  assert.equal(assertTenantBoundary({
    actorTenant: 'beverly_hills_rp',
    targetTenant: 'blood_diamond_rp',
    actorIsOwner: true,
  }), true);
});

test('former staff access is limited to Pixel Network Office profile', () => {
  assert.equal(canFormerStaffAccess('pixel_network_office'), true);
  assert.equal(canFormerStaffAccess('beverly_hills_rp'), false);
  assert.equal(canFormerStaffAccess('blood_diamond_rp'), false);
  assert.equal(canFormerStaffAccess('customer_support'), false);
});

test('customer support profile enables product support but not FiveM admin control', () => {
  assert.equal(assertTenantModuleEnabled('customer_support', 'customer_script_support'), true);
  assert.equal(assertTenantModuleEnabled('customer_support', 'resolution_sync'), true);
  assert.throws(() => assertTenantModuleEnabled('customer_support', 'restart_control'), /disabled/);
});

test('high-impact modules stay disabled until explicitly enabled', () => {
  clearTenantModuleOverrides();
  assert.throws(() => assertTenantModuleEnabled('beverly_hills_rp', 'restart_control'), /disabled/);
  assert.throws(() => assertTenantModuleEnabled('beverly_hills_rp', 'mass_unban'), /disabled/);
  enableTenantModule('beverly_hills_rp', 'restart_control');
  assert.equal(assertTenantModuleEnabled('beverly_hills_rp', 'restart_control'), true);
  clearTenantModuleOverrides();
  assert.throws(() => assertTenantModuleEnabled('beverly_hills_rp', 'restart_control'), /disabled/);
});

test('unknown module keys fail closed instead of looking merely disabled', () => {
  assert.throws(() => assertTenantModuleEnabled('beverly_hills_rp', 'not-a-module'), /Unknown Discord module/);
  assert.throws(() => assertTenantModuleEnabled('beverly_hills_rp', null), /Unknown Discord module/);
});
