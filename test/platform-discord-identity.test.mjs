import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  createDiscordIdentityAdapter,
  requireVerifiedActor,
  requireVerifiedToolConfirmation,
} from '../src/platform/discord-identity.mjs';

const HTTP_ENTRYPOINTS = [
  'src/index.mjs',
  'src/webhook-handler.mjs',
  'src/commands.mjs',
  'src/gpt.mjs',
];

const FORBIDDEN_HTTP_PATTERNS = [
  [/from ['"]\.\/platform\//, 'must not import platform modules'],
  [/create(?:AiTicketAgent|Approval|Commerce|Ticket|Gang|Handoff|Applications|FiveMOps|CommunityUtilities)Engine/, 'must not construct platform engines'],
  [/discord-identity/, 'must not import discord-identity seals'],
  [/tenant-module-overrides/, 'must not import tenant module overrides'],
  [/enableTenantModule/, 'must not call enableTenantModule'],
  [/clearTenantModuleOverrides/, 'must not call clearTenantModuleOverrides'],
  [/getTenantModules/, 'must not import getTenantModules'],
  [/setTenantModuleOverride/, 'must not import setTenantModuleOverride'],
  [/peekTenantModuleOverride/, 'must not import peekTenantModuleOverride'],
];

test('HTTP/Discord entrypoints do not import platform engines, identity seals, or module flips', () => {
  assert.equal(existsSync('src/platform/tenant-module-overrides.mjs'), false, 'runtime tenant-module-overrides.mjs must not exist');

  for (const path of HTTP_ENTRYPOINTS) {
    const source = readFileSync(path, 'utf8');
    for (const [pattern, message] of FORBIDDEN_HTTP_PATTERNS) {
      assert.equal(pattern.test(source), false, `${path} ${message}`);
    }
  }

  for (const name of readdirSync('src')) {
    if (!name.endsWith('.mjs')) continue;
    const path = join('src', name);
    const source = readFileSync(path, 'utf8');
    assert.equal(/enableTenantModule/.test(source), false, `${path} must not reference enableTenantModule`);
    assert.equal(/from ['"]\.\/platform\/discord-identity/.test(source), false, `${path} must not import discord-identity`);
    assert.equal(/tenant-module-overrides/.test(source), false, `${path} must not import tenant-module-overrides`);
  }
});

test('bindMember is fixture-only and rejects Symbol.for forged actor bags', () => {
  const identity = createDiscordIdentityAdapter({
    guildTenantMap: { 'guild-bh': 'beverly_hills_rp' },
  });
  const actor = identity.bindMember({
    guildId: 'guild-bh',
    member: { id: 'user-1', roles: ['bh-staff'] },
  });
  assert.equal(actor.userId, 'user-1');
  assert.equal(actor.tenantId, 'beverly_hills_rp');
  assert.deepEqual(actor.roleIds, ['bh-staff']);
  assert.equal(requireVerifiedActor(actor).userId, 'user-1');

  assert.throws(() => requireVerifiedActor({
    userId: 'user-1',
    tenantId: 'beverly_hills_rp',
    roleIds: ['bh-staff'],
  }), /Unverified Discord identity/);

  const forgedGlobal = {
    [Symbol.for('pixenetwork.discord.verifiedActor')]: true,
    userId: 'forged',
    tenantId: 'beverly_hills_rp',
    roleIds: ['bh-owner'],
  };
  assert.throws(() => requireVerifiedActor(forgedGlobal), /Unverified Discord identity/);
});

test('tool confirmations require ticket bind, nonce, and createdAt and reject forged seals', () => {
  const identity = createDiscordIdentityAdapter({
    guildTenantMap: { 'guild-bh': 'beverly_hills_rp' },
  });
  assert.throws(() => identity.confirmToolResult({
    toolName: 'x',
    confirmationId: 'y',
  }), /ticketId is required/);

  const sealed = identity.confirmToolResult({
    toolName: 'staff.cache_clear',
    confirmationId: 'ops_1',
    ticketId: 'ticket_a',
    nonce: 'nonce-1',
  });
  assert.equal(sealed.ticketId, 'ticket_a');
  assert.equal(sealed.nonce, 'nonce-1');
  assert.ok(sealed.createdAt);
  assert.equal(requireVerifiedToolConfirmation(sealed).nonce, 'nonce-1');

  assert.throws(() => requireVerifiedToolConfirmation({
    [Symbol.for('pixenetwork.discord.verifiedToolConfirmation')]: true,
    toolName: 'x',
    confirmationId: 'y',
    ticketId: 'ticket_a',
    nonce: 'n',
    createdAt: new Date().toISOString(),
  }), /Unverified tool confirmation/);
});
