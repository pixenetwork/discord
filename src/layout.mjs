import { ChannelType, PermissionFlagsBits } from 'discord.js';

const PUBLICATION_TAGS = [
  'Japanese',
  'Chinese',
  'Official JMA',
  'Magazine',
  'Newsletter',
  'Show Book',
  'Breeder',
  'Strain',
  'Genetics',
  'Lineage',
  'Husbandry',
  'Kagami',
  'Ryurin',
  'Dragon Scale',
  'Shrimp',
].map((name) => ({ name, moderated: false }));

const MAGAZINE_ISSUE_TAGS = [
  'Issue',
  'English Guide',
  'Reading Notes',
  'History',
  'Breeding',
  'Traits',
  'Genetics',
  'Care',
].map((name) => ({ name, moderated: false }));

const CORE_LAYOUT = [
  {
    category: '🫧・AQUAPHORIA — START HERE',
    channels: [
      ['👋・welcome', 'Welcome to Aquaphoria. Start here for store, community, and support information.'],
      ['📜・rules', 'Aquaphoria community rules and customer policies.'],
      ['🧾・how-to-order', 'How to order livestock, preorders, and dry goods from Aquaphoria.'],
      ['📢・announcements', 'Aquaphoria announcements, launches, imports, and important updates.'],
      ['🌐・website', 'Official Aquaphoria website and storefront links.'],
    ],
  },
  {
    category: '🛒・SHOP AQUAPHORIA',
    channels: [
      ['🆕・new-arrivals', 'Newest Aquaphoria livestock and product arrivals.'],
      ['✅・available-now', 'Livestock and products currently available to purchase.'],
      ['🛒・preorders', 'Current Aquaphoria preorder listings and import opportunities.'],
      ['🔁・sold-out-coming-back', 'Sold-out livestock and products expected to return.'],
      ['📦・shipping-updates', 'Shipping, import, and fulfillment updates.'],
    ],
  },
  {
    category: '🐟・MEDAKA & FISH',
    channels: [
      ['🐟・medaka-available', 'Medaka and freshwater fish currently available.'],
      ['🥚・medaka-preorders', 'Upcoming and active Medaka and freshwater fish preorders.'],
      ['💬・medaka-discussion', 'Medaka and freshwater fish discussion, care, breeding, and questions.'],
      ['📸・medaka-showcase', 'Showcase your Medaka and freshwater fish.'],
    ],
  },
  {
    category: '🦐・SHRIMP',
    channels: [
      ['🦐・shrimp-available', 'Freshwater shrimp currently available.'],
      ['🦐・shrimp-preorders', 'Upcoming and active freshwater shrimp preorders.'],
      ['💬・shrimp-discussion', 'Freshwater shrimp discussion, care, grading, breeding, and questions.'],
      ['📸・shrimp-showcase', 'Showcase your freshwater shrimp and colonies.'],
    ],
  },
  {
    category: '🔎・REQUEST DESK',
    channels: [
      ['🎟️・open-a-ticket', 'Open a private Aquaphoria ticket for strain requests, order help, fish or shrimp questions, or general support.'],
    ],
  },
  {
    category: '📚・AQUAPEDIA',
    channels: [
      ['📚・aquapedia', 'Aquaphoria knowledge base highlights and Aquapedia updates.'],
      ['🐟・medaka-guides', 'Medaka strain, care, breeding, and identification guides.'],
      ['🦐・shrimp-guides', 'Freshwater shrimp care, grading, breeding, and identification guides.'],
      ['🩺・care-help', 'General freshwater aquarium husbandry and care help.'],
    ],
    forums: [{
      name: '🐟・medaka-research',
      topic: 'Public Medakapedia indexes for Japanese breeders, strains, documented lineages and competition evidence. Research claims carry provenance and review status.',
      tags: ['Breeder', 'Strain', 'Lineage', 'Competition', 'Evidence'].map((name) => ({ name, moderated: false })),
    }, {
      name: '🦐・shrimp-research',
      topic: 'Public source-backed ornamental shrimp breeder and competition research. Each breeder or event gets its own thread; award entrant is not automatically strain inventor.',
      tags: ['Breeder', 'Strain', 'Competition', 'Lineage', 'Genetics', 'Husbandry'].map((name) => ({ name, moderated: false })),
    }, {
      name: '🐉・arowana-research',
      topic: 'Public Aquapedia arowana species, geographic origins, genetics, husbandry, breeders and conservation. Claims are evidence-labelled and wildlife collection localities are protected.',
      tags: ['Species', 'Genetics', 'Regional', 'Breeding', 'Conservation'].map((name) => ({ name, moderated: false })),
    }, {
      name: 'magazines-and-articles',
      protectExisting: true,
      topic: 'PUBLIC AQUAPEDIA — ONLY medaka and freshwater shrimp magazines, newsletters, and articles. One thread per issue/article; begin with Issue 1 where available. Free English reading guides and rights-cleared translated excerpts are clearly labeled. No unlicensed reproductions.',
      tags: ['Magazine', 'Newsletter', 'Article', 'Medaka', 'Shrimp', 'English Guide', 'Licensed Translation', 'Free to Read'].map((name) => ({ name, moderated: false })),
    }, {
      name: '📖・medaka-hyakka',
      protectExisting: true,
      topic: 'Aquapedia public Medaka Hyakka / メダカ百華 — issue number, subject, English reading guide, references and historical context. No republished copyrighted magazine scans.',
      tags: MAGAZINE_ISSUE_TAGS,
    }, {
      name: '📘・medaka-advance',
      protectExisting: true,
      topic: 'Aquapedia public Medaka Advance / eBookMAG — issue number, subject, English reading guide, references and historical context. No republished copyrighted magazine scans.',
      tags: MAGAZINE_ISSUE_TAGS,
    }, {
      name: '🦐・shrimp-club',
      protectExisting: true,
      topic: 'Aquapedia public Shrimp Club / シュリンプクラブ — issue number, subject, English reading guide, references and historical context. No republished copyrighted magazine scans.',
      tags: MAGAZINE_ISSUE_TAGS,
    }, {
      name: '🐟・medaka-trip',
      protectExisting: true,
      topic: 'Aquapedia public Medaka Trip / メダカトリップ — issue number, subject, English reading guide, references and historical context. No republished copyrighted magazine scans.',
      tags: MAGAZINE_ISSUE_TAGS,
    }],
  },
  {
    category: '🌿・COMMUNITY',
    channels: [
      ['💬・general', 'General Aquaphoria community conversation.'],
      ['🪴・show-your-tanks', 'Show your aquariums, ponds, setups, and aquascapes.'],
      ['🧬・breeding-projects', 'Share breeding projects, fry, juveniles, and line-development progress.'],
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
    vendorOnly: true,
    channels: [
      ['🔎・research', 'Private /research and /gpt research workspace for approved vendors and Aquaphoria management.'],
      ['🧬・research-results', 'Private completed Aquapedia research summaries and source-backed additions.'],
      ['📝・research-queue', 'Private research requests waiting for verification or additional evidence.'],
    ],
    forums: [
      {
        name: '📚・translated-publications',
        topic: 'Private English research companions and authorized translations of medaka and shrimp publications, with source, issue, year, and provenance on every post.',
        tags: PUBLICATION_TAGS,
      },
    ],
  },
  {
    category: '🛡️・AQUAPHORIA STAFF',
    staffOnly: true,
    channels: [
      ['💬・staff-chat', 'Private Aquaphoria staff coordination.'],
      ['🧾・orders', 'Private order operations and fulfillment coordination.'],
      ['🔎・strain-requests', 'Private queue for customer strain sourcing requests.'],
      ['🌏・sourcing', 'Private sourcing, breeder, import, and availability coordination.'],
      ['🤖・bot-log', 'Aquaphoria Discord worker health and integration errors.'],
      ['🎫・ticket-log', 'Aquaphoria support and strain-request ticket lifecycle log.'],
    ],
  },
  {
    category: '📚・AQUAPHORIA LIBRARY',
    libraryOnly: true,
    channels: [
      ['📚・library', 'Read-only home for preserved legacy Duy-era material and useful historical reference.'],
    ],
  },
];

async function ensureRole(guild, name, preferredRoleId = null) {
  if (preferredRoleId) {
    const canonical = guild.roles.cache.get(String(preferredRoleId));
    if (canonical) return canonical;
  }

  const matches = guild.roles.cache.filter((role) => role.name === name);
  if (matches.size > 1) {
    throw new Error(`Multiple Discord roles named "${name}" exist; remove the ambiguity before provisioning`);
  }
  const existing = matches.first();
  if (existing) return existing;
  return guild.roles.create({ name, reason: 'Aquaphoria Discord layout provisioning' });
}

async function syncPrivateOverwrites(channel, permissionOverwrites) {
  if (!permissionOverwrites) return;
  await channel.permissionOverwrites.set(permissionOverwrites, 'Enforce Aquaphoria private access boundary');
}

async function ensureCategory(guild, name, permissionOverwrites = undefined) {
  const existing = guild.channels.cache.find((channel) => channel.type === ChannelType.GuildCategory && channel.name === name);
  if (existing) {
    await syncPrivateOverwrites(existing, permissionOverwrites);
    return existing;
  }
  return guild.channels.create({ name, type: ChannelType.GuildCategory, permissionOverwrites, reason: 'Aquaphoria Discord layout provisioning' });
}

async function ensureForumChannel(guild, parent, { name, topic, tags, protectExisting = false }, permissionOverwrites = undefined, reason = 'Aquaphoria forum provisioning') {
  if (protectExisting) {
    const everyone = guild?.roles?.everyone;
    const publicRead = (channel) => channel?.permissionsFor?.(everyone)?.has(PermissionFlagsBits.ViewChannel)
      && channel?.permissionsFor?.(everyone)?.has(PermissionFlagsBits.ReadMessageHistory);
    if (!everyone || !publicRead(parent)) {
      throw new Error(`Magazine public category access drift: ${name}`);
    }
    const colliding = guild.channels.cache.find((channel) => channel.name === name
      && (channel.parentId !== parent.id || channel.type !== ChannelType.GuildForum));
    if (colliding) throw new Error(`Magazine forum collision outside its public category: ${name}`);
    // A duplicate in the *same* category is equally ambiguous; never pick the first.
    const sameNamedForums = guild.channels.cache.filter((channel) => channel.name === name);
    if (sameNamedForums.size > 1) throw new Error(`Magazine duplicate forums: ${name}`);
  }
  const existing = guild.channels.cache.find(
    (channel) => channel.type === ChannelType.GuildForum && channel.name === name && channel.parentId === parent.id,
  );
  if (existing) {
    if (protectExisting) {
      const everyone = guild.roles.everyone;
      const hasAccess = existing.permissionsFor?.(everyone)?.has(PermissionFlagsBits.ViewChannel)
        && existing.permissionsFor?.(everyone)?.has(PermissionFlagsBits.ReadMessageHistory);
      if (!hasAccess) throw new Error(`Magazine forum not public: ${name}`);
      const expectedNames = tags.map((tag) => tag.name);
      const liveNames = (existing.availableTags ?? []).map((tag) => tag.name);
      if (JSON.stringify(liveNames) !== JSON.stringify(expectedNames)
        || (existing.availableTags ?? []).some((tag) => !tag.id)) {
        throw new Error(`Magazine forum tags drift: ${name}`);
      }
      if (existing.topic !== topic) throw new Error(`Magazine forum topic drift: ${name}`);
      return existing;
    }
    const existingTagIds = new Map((existing.availableTags ?? []).map((tag) => [tag.name, tag.id]));
    const availableTags = tags.map((tag) => ({
      ...tag,
      ...(existingTagIds.has(tag.name) ? { id: existingTagIds.get(tag.name) } : {}),
    }));
    await existing.edit({ topic, availableTags }, reason);
    await syncPrivateOverwrites(existing, permissionOverwrites);
    return existing;
  }
  if (protectExisting) throw new Error(`Magazine forum missing; refusing to replace historical issue threads: ${name}`);
  return guild.channels.create({
    name,
    type: ChannelType.GuildForum,
    parent: parent.id,
    topic,
    availableTags: tags,
    permissionOverwrites,
    reason,
  });
}

async function ensureTextChannel(guild, parent, name, topic, permissionOverwrites = undefined) {
  const existing = guild.channels.cache.find((channel) => channel.type === ChannelType.GuildText && channel.name === name && channel.parentId === parent.id);
  if (existing) {
    if (topic && existing.topic !== topic) await existing.setTopic(topic, 'Sync Aquaphoria channel topic');
    await syncPrivateOverwrites(existing, permissionOverwrites);
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
  const owner = guild.members?.cache?.get?.(String(ownerUserId))?.user
    ?? guild.client?.users?.cache?.get?.(String(ownerUserId));
  if (!owner) {
    throw new Error(`Aquaphoria owner ${ownerUserId} is not cached in the configured guild; refusing to provision private channels`);
  }
  return [
    { id: guild.roles.everyone, deny: [PermissionFlagsBits.ViewChannel] },
    { id: owner, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
    { id: guild.roles.cache.get(String(staffRoleId)), allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
    ...(vendorRoleId ? [{ id: guild.roles.cache.get(String(vendorRoleId)), allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }] : []),
  ];
}

export async function provisionAquaphoriaLayout(guild, { ownerUserId, store = null, includePublicMagazines = true }) {
  if (includePublicMagazines) {
    // All historical magazine forums must exist and match BEFORE any role/channel writes.
    // Otherwise a late failure could leave research/commerce categories partially edited.
    const section = CORE_LAYOUT.find((entry) => entry.category === '📚・AQUAPEDIA');
    const parent = guild.channels.cache.find((channel) => channel.type === ChannelType.GuildCategory
      && channel.name === section.category);
    if (!parent) throw new Error('Magazine public category missing; refusing partial layout update');
    for (const spec of section.forums.filter((entry) => entry.protectExisting)) {
      await ensureForumChannel(guild, parent, spec, undefined, 'Read-only magazine layout preflight');
    }
  }
  const previousRoles = store ? await store.getLayoutRoles() : null;
  const staffRole = await ensureRole(guild, 'Aquaphoria Staff', previousRoles?.staffRoleId);
  const vendorRole = await ensureRole(guild, 'Verified Aquaphoria Vendor', previousRoles?.vendorRoleId);
  const memberRole = await ensureRole(guild, 'Aquaphoria Member', previousRoles?.memberRoleId);
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
      created.push({ category: category.name, channel: channel.name, id: channel.id, type: 'text' });
    }
    for (const forumSpec of section.forums ?? []) {
      // Commerce/vendor flows do not depend on public magazine metadata.
      // Owner /aquaphoria setup retains strict fail-closed magazine drift checks.
      if (!includePublicMagazines && forumSpec.protectExisting) continue;
      const reason = section.category === '📚・AQUAPEDIA'
        ? 'Aquaphoria public Aquapedia forum provisioning'
        : 'Aquaphoria private publication forum provisioning';
      const channel = await ensureForumChannel(guild, category, forumSpec, permissionOverwrites, reason);
      created.push({ category: category.name, channel: channel.name, id: channel.id, type: 'forum' });
    }
  }

  if (store) {
    await store.setLayoutRoles({ staffRoleId: staffRole.id, vendorRoleId: vendorRole.id, memberRoleId: memberRole.id });
  }

  return {
    roles: { staffRoleId: staffRole.id, vendorRoleId: vendorRole.id, memberRoleId: memberRole.id },
    channels: created,
  };
}

export async function provisionTranslatedPublicationsForum(guild, { ownerUserId, store = null }) {
  const previousRoles = store ? await store.getLayoutRoles() : null;
  const staffRole = await ensureRole(guild, 'Aquaphoria Staff', previousRoles?.staffRoleId);
  const vendorRole = await ensureRole(guild, 'Verified Aquaphoria Vendor', previousRoles?.vendorRoleId);
  const overwrites = privateOverwrites(guild, {
    ownerUserId,
    staffRoleId: staffRole.id,
    vendorRoleId: vendorRole.id,
  });
  const section = CORE_LAYOUT.find((entry) => entry.category === '🔬・AQUAPEDIA RESEARCH');
  const forumSpec = section?.forums?.find((entry) => entry.name === '📚・translated-publications');
  if (!section || !forumSpec) throw new Error('Translated publications forum definition is missing');
  const category = await ensureCategory(guild, section.category, overwrites);
  const channel = await ensureForumChannel(guild, category, forumSpec, overwrites, 'Aquaphoria private translated-publications forum provisioning');
  return { categoryId: category.id, channelId: channel.id, channelName: channel.name };
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

export function publicationTagDefinitions() {
  return structuredClone(PUBLICATION_TAGS);
}

async function provisionPublicAquapediaForum(guild, name) {
  const section = CORE_LAYOUT.find((entry) => entry.category === '📚・AQUAPEDIA');
  const spec = section?.forums?.find((entry) => entry.name === name);
  if (!spec) throw new Error('Aquapedia public research forum definition is missing');
  // Do not make an existing private category public or create a competing one.
  const category = guild?.channels?.cache?.find(
    (channel) => channel.type === ChannelType.GuildCategory && channel.name === section.category,
  );
  if (!category) return { status: 'category_not_found' };
  const everyone = guild?.roles?.everyone;
  if (!everyone || (!category.permissionsFor?.(everyone)?.has(PermissionFlagsBits.ViewChannel)
    || !category.permissionsFor?.(everyone)?.has(PermissionFlagsBits.ReadMessageHistory))) {
    return { status: 'category_not_public' };
  }
  const existing = guild.channels.cache.find(
    (channel) => channel.type === ChannelType.GuildForum && channel.parentId === category.id && channel.name === spec.name,
  );
  if (existing && (!existing.permissionsFor?.(everyone)?.has(PermissionFlagsBits.ViewChannel)
    || !existing.permissionsFor?.(everyone)?.has(PermissionFlagsBits.ReadMessageHistory))) {
    return { status: 'forum_not_public' };
  }
  const channel = await ensureForumChannel(guild, category, spec, undefined, (name === '🦐・shrimp-research' ? 'Aquaphoria public shrimp research forum provisioning' : 'Aquaphoria public arowana research forum provisioning'));
  if (!channel.permissionsFor?.(everyone)?.has(PermissionFlagsBits.ViewChannel)
    || !channel.permissionsFor?.(everyone)?.has(PermissionFlagsBits.ReadMessageHistory)) {
    return { status: 'forum_not_public' };
  }
  return { status: 'ready', categoryId: category.id, channelId: channel.id, forumName: channel.name };
}

export async function provisionShrimpPublicResearchForum(guild) {
  return provisionPublicAquapediaForum(guild, '🦐・shrimp-research');
}

export async function provisionArowanaPublicResearchForum(guild) {
  return provisionPublicAquapediaForum(guild, '🐉・arowana-research');
}
