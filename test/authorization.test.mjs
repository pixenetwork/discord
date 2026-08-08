import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createStore } from '../src/store.mjs';
import {
  isCanonicalStaff,
  memberHasCanonicalRole,
  revokeVendorAccess,
} from '../src/authorization.mjs';

test('canonical staff authorization accepts a renamed role by ID', async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), 'aquaphoria-auth-'));
  try {
    const store = createStore({ dataDir });
    await store.setLayoutRoles({
      staffRoleId: 'canonical-staff-id',
      vendorRoleId: 'canonical-vendor-id',
      memberRoleId: 'canonical-member-id',
    });
    const interaction = {
      member: {
        roles: {
          cache: {
            has: (roleId) => roleId === 'canonical-staff-id',
            values: () => [{ id: 'canonical-staff-id', name: 'Renamed Operations Team' }][Symbol.iterator](),
          },
        },
      },
    };

    assert.equal(memberHasCanonicalRole(interaction.member, 'canonical-staff-id'), true);
    assert.equal(await isCanonicalStaff(interaction, store), true);
  } finally {
    await rm(dataDir, { recursive: true, force: true });
  }
});

test('duplicate role name without the canonical ID fails closed', async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), 'aquaphoria-auth-'));
  try {
    const store = createStore({ dataDir });
    await store.setLayoutRoles({
      staffRoleId: 'canonical-staff-id',
      vendorRoleId: 'canonical-vendor-id',
    });
    const interaction = {
      member: {
        roles: {
          cache: {
            has: () => false,
            values: () => [{ id: 'attacker-role-id', name: 'Aquaphoria Staff' }][Symbol.iterator](),
          },
        },
      },
    };

    assert.equal(await isCanonicalStaff(interaction, store), false);
  } finally {
    await rm(dataDir, { recursive: true, force: true });
  }
});

test('disabling a vendor removes shared and private vendor roles', async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), 'aquaphoria-auth-'));
  try {
    const store = createStore({ dataDir });
    await store.setLayoutRoles({
      staffRoleId: 'staff-role',
      vendorRoleId: 'shared-vendor-role',
    });
    const removed = [];
    const member = {
      roles: {
        cache: new Map(),
        async remove(roleIds, reason) {
          removed.push({ roleIds, reason });
        },
      },
    };
    const guild = {
      members: {
        cache: new Map([['vendor-user', member]]),
        async fetch() {
          throw new Error('cache should satisfy member lookup');
        },
      },
    };
    const result = await revokeVendorAccess(guild, {
      discordUserId: 'vendor-user',
      discordRoleId: 'private-vendor-role',
    }, store);

    assert.deepEqual(result.removedRoleIds, ['shared-vendor-role', 'private-vendor-role']);
    assert.deepEqual(removed[0].roleIds, ['shared-vendor-role', 'private-vendor-role']);
    assert.equal(removed[0].reason, 'Aquaphoria vendor disabled');
  } finally {
    await rm(dataDir, { recursive: true, force: true });
  }
});

test('layout roles require staff and vendor IDs', async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), 'aquaphoria-auth-'));
  try {
    const store = createStore({ dataDir });
    await assert.rejects(
      () => store.setLayoutRoles({ staffRoleId: '123' }),
      /Staff and vendor role IDs are required/,
    );
  } finally {
    await rm(dataDir, { recursive: true, force: true });
  }
});
