import { ChannelType, PermissionFlagsBits } from 'discord.js';

const CORE_LAYOUT = [
  {
    category: '🌊・AQUAPHORIA',
    channels: [
      ['👋・welcome', 'Welcome to Aquaphoria. Start here for store, community, and support information.'],
      ['📢・announcements', 'Aquaphoria announcements, launches, imports, and important updates.'],
      ['🛒・shop', 'Aquaphoria storefront links, featured collections, and shopping information.'],
      ['🧬・aquapedia', 'Aquapedia strain, breeder, shrimp, and aquarium research hub.'],
    ],
  },
  {
    category: '🎫・CUSTOMER SUPPORT',
    channels: [
      ['🎟️・open-a-ticket', 'Open a customer support, order, shipping, or DOA ticket here.'],
      ['📦・order-help', 'Order status, shipping, tracking, and fulfillment help.'],
      ['❓・faq', 'Frequently asked questions and Aquaphoria policies.'],
    ],
  },
  {
    category: '🐟・BREEDER MARKETPLACE',
    vendorOnly: true,
    channels: [
      ['📢・vendor-updates', 'Private announcements for approved Aquaphoria breeders and vendors.'],
      ['📖・vendor-guide', 'Vendor listing template, shipping rules, product standards, and fulfillment process.'],
      ['🧰・catalog-commands', 'Use vendor slash commands here to add, edit, stock, hide, or archive your own products.'],
      ['📦・vendor-orders', 'Vendor order dashboard and fulfillment notices.'],
      ['💰・payouts', 'Private payout status and vendor payment information.'],
    ],
  },
  {
    category: '🔬・AQUAPEDIA RESEARCH',
    channels: [
      ['🔎・research', 'Run /research strain or /research breeder to send evidence-backed work to Aquapedia.'],
      ['🧬・research-results', 'Completed Aquapedia research summaries and source-backed additions.'],
      ['📝・research-queue', 'Research requests waiting for verification or additional evidence.'],
    ],
  },
  {
    category: '🛡️・AQUAPHORIA STAFF',
    staffOnly: true,
    channels: [
      ['🧾・audit-log', 'Product, vendor, order, permission, and research audit events.'],
      ['🚨・order-issues', 'Fulfillment, stock, DOA, and shipping exceptions requiring staff attention.'],
      ['💳・payout-log', 'Internal vendor payout ledger and payment confirmations.'],
      ['🤖・bot-log', 'Aquaphoria Discord worker health and integration errors.'],
    ],
  },
];

async function ensureRole(guild, name) {
  const existing = guild.roles.cache.find((role) => role.name === name);
  if (existing) return existing;
  return guild.roles.create({ name, reason: 'Aquaphoria Discord layout provisioning' });
}

async function ensureCategory(guild, name, permissionOverwrites = undefined) {
  const existing = guild.channels.cache.find((channel) => channel.type === ChannelType.GuildCategory && channel.name === name);
  if (existing) return existing;
  return guild.channels.create({ name, type: ChannelType.GuildCategory, permissionOverwrites, reason: 'Aquaphoria Discord layout provisioning' });
}

async function ensureTextChannel(guild, parent, name, topic, permissionOverwrites = undefined) {
  const existing = guild.channels.cache.find((channel) => channel.type === ChannelType.GuildText && channel.name === name && channel.parentId === parent.id);
  if (existing) {
    if (topic && existing.topic !== topic) await existing.setTopic(topic, 'Sync Aquaphoria channel topic');
    return existing;
  }
  return guild.channels.create({
    name,
    type: ChannelType.GuildText,
    parent: parent.id,
    topic,
    permissionOverwrites,
    reason: 'Aquaphoria Discord layout provisioning',
  });
}

function privateOverwrites(guild, { ownerUserId, staffRoleId, vendorRoleId = null }) {
  return [
    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: ownerUserId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
    { id: staffRoleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
    ...(vendorRoleId ? [{ id: vendorRoleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }] : []),
  ];
}

export async function provisionAquaphoriaLayout(guild, { ownerUserId }) {
  const staffRole = await ensureRole(guild, 'Aquaphoria Staff');
  const vendorRole = await ensureRole(guild, 'Verified Aquaphoria Vendor');
  const memberRole = await ensureRole(guild, 'Aquaphoria Member');
  const created = [];

  for (const section of CORE_LAYOUT) {
    const permissionOverwrites = section.staffOnly
      ? privateOverwrites(guild, { ownerUserId, staffRoleId: staffRole.id })
      : section.vendorOnly
        ? privateOverwrites(guild, { ownerUserId, staffRoleId: staffRole.id, vendorRoleId: vendorRole.id })
        : undefined;

    const category = await ensureCategory(guild, section.category, permissionOverwrites);
    for (const [name, topic] of section.channels) {
      const channel = await ensureTextChannel(guild, category, name, topic, permissionOverwrites);
      created.push({ category: category.name, channel: channel.name, id: channel.id });
    }
  }

  return {
    roles: { staffRoleId: staffRole.id, vendorRoleId: vendorRole.id, memberRoleId: memberRole.id },
    channels: created,
  };
}

export async function ensureVendorWorkspace(guild, { vendor, ownerUserId, staffRoleId }) {
  let vendorRole = vendor.discordRoleId ? guild.roles.cache.get(vendor.discordRoleId) : null;
  if (!vendorRole) vendorRole = await ensureRole(guild, `Vendor • ${vendor.displayName}`);

  const overwrites = privateOverwrites(guild, {
    ownerUserId,
    staffRoleId,
    vendorRoleId: vendorRole.id,
  });

  const category = await ensureCategory(guild, `🐟・${vendor.displayName.toUpperCase()} HQ`, overwrites);
  const channels = [];
  for (const [name, topic] of [
    ['📦・orders', `Private ${vendor.displayName} fulfillment tickets and order notices.`],
    ['🛍️・catalog', `Manage ${vendor.displayName}'s Aquaphoria catalog.`],
    ['💬・vendor-chat', `Private communication between ${vendor.displayName} and Aquaphoria staff.`],
  ]) {
    channels.push(await ensureTextChannel(guild, category, name, topic, overwrites));
  }

  return { vendorRoleId: vendorRole.id, categoryId: category.id, channelIds: channels.map((channel) => channel.id) };
}

export function layoutDefinition() {
  return structuredClone(CORE_LAYOUT);
}
