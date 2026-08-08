export function memberHasCanonicalRole(member, roleId) {
  return Boolean(roleId && member?.roles?.cache?.has(String(roleId)));
}

export async function isCanonicalStaff(interaction, store) {
  const roles = await store.getLayoutRoles();
  return memberHasCanonicalRole(interaction.member, roles?.staffRoleId);
}

export async function getCanonicalStaffRole(guild, store) {
  const roles = await store.getLayoutRoles();
  if (!roles?.staffRoleId) return null;
  return guild.roles.cache.get(roles.staffRoleId) ?? null;
}

function isUnknownMember(error) {
  return error?.code === 10007 || error?.code === '10007' || error?.status === 404;
}

export async function revokeVendorAccess(guild, vendor, store) {
  const layoutRoles = await store.getLayoutRoles();
  const roleIds = [...new Set([
    layoutRoles?.vendorRoleId,
    vendor?.discordRoleId,
  ].filter(Boolean).map(String))];

  if (!vendor?.discordUserId || !roleIds.length) return { memberFound: false, removedRoleIds: [] };

  let member = guild.members.cache?.get(String(vendor.discordUserId)) ?? null;
  if (!member) {
    try {
      member = await guild.members.fetch(String(vendor.discordUserId));
    } catch (error) {
      if (isUnknownMember(error)) return { memberFound: false, removedRoleIds: [] };
      throw error;
    }
  }

  await member.roles.remove(roleIds, 'Aquaphoria vendor disabled');
  return { memberFound: true, removedRoleIds: roleIds };
}
