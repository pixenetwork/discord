import { createDiscordIdentityAdapter } from '../../src/platform/discord-identity.mjs';

export const GUILD_TENANT_MAP = Object.freeze({
  'guild-bh': 'beverly_hills_rp',
  'guild-bd': 'blood_diamond_rp',
  'guild-cs': 'customer_support',
  'guild-office': 'pixel_network_office',
});

export const TENANT_GUILD = Object.freeze({
  beverly_hills_rp: 'guild-bh',
  blood_diamond_rp: 'guild-bd',
  customer_support: 'guild-cs',
  pixel_network_office: 'guild-office',
});

export function createTestIdentityAdapter(extraMap = {}) {
  return createDiscordIdentityAdapter({
    guildTenantMap: { ...GUILD_TENANT_MAP, ...extraMap },
  });
}

export function bindActor(identity, tenantId, userId, roleIds = []) {
  const guildId = TENANT_GUILD[tenantId];
  if (!guildId) throw new Error(`No guild fixture for tenant ${tenantId}`);
  return identity.bindMember({
    guildId,
    member: { id: userId, roles: roleIds },
  });
}
