import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createDiscordIdentityAdapter, requireVerifiedActor } from '../src/platform/discord-identity.mjs';

const HTTP_ENTRYPOINTS = [
  'src/index.mjs',
  'src/webhook-handler.mjs',
  'src/commands.mjs',
  'src/gpt.mjs',
];

test('HTTP/Discord entrypoints do not import or construct platform engines from request JSON', () => {
  for (const path of HTTP_ENTRYPOINTS) {
    const source = readFileSync(path, 'utf8');
    assert.equal(/from ['"]\.\/platform\//.test(source), false, `${path} must not import platform engines`);
    assert.equal(/create(?:AiTicketAgent|Approval|Commerce|Ticket|Gang|Handoff|Applications|FiveMOps|CommunityUtilities)Engine/.test(source), false, `${path} must not construct platform engines`);
  }
});

test('Discord identity adapter seals guild member identity and rejects spoofed bags', () => {
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
});
