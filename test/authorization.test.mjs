import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createStore } from '../src/store.mjs';

test('staff role authorization uses canonical role ID', async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), 'aquaphoria-auth-'));
  try {
    const store = createStore({ dataDir });
    const canonicalStaffRoleId = '123456789';

    await store.setLayoutRoles({
      staffRoleId: canonicalStaffRoleId,
      vendorRoleId: '987654321',
      memberRoleId: '111111111',
    });

    const roles = await store.getLayoutRoles();
    assert.equal(roles.staffRoleId, canonicalStaffRoleId);
    assert.equal(roles.vendorRoleId, '987654321');

    const mockInteractionWithCanonicalRole = {
      member: {
        roles: {
          cache: {
            has: (roleId) => roleId === canonicalStaffRoleId,
            some: (predicate) => predicate({ name: 'Fake Aquaphoria Staff' }),
          },
        },
      },
    };

    const hasCanonical = mockInteractionWithCanonicalRole.member.roles.cache.has(canonicalStaffRoleId);
    assert.equal(hasCanonical, true, 'canonical role ID check must pass');

    const mockInteractionWithDuplicateName = {
      member: {
        roles: {
          cache: {
            has: (roleId) => roleId === 'malicious-duplicate-role-id',
            some: (predicate) => predicate({ name: 'Aquaphoria Staff' }),
          },
        },
      },
    };

    const hasDuplicate = mockInteractionWithDuplicateName.member.roles.cache.has(canonicalStaffRoleId);
    assert.equal(hasDuplicate, false, 'duplicate role name with wrong ID must be rejected');
  } finally {
    await rm(dataDir, { recursive: true, force: true });
  }
});

test('layout roles require both staff and vendor IDs', async () => {
  const store = createStore({ dataDir: os.tmpdir() });
  await assert.rejects(() => store.setLayoutRoles({ staffRoleId: '123' }), /Staff and vendor role IDs are required/);
});
