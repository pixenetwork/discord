import {
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import { centsToMoney, moneyToCents } from './pricing.mjs';
import { ensureVendorWorkspace, provisionAquaphoriaLayout } from './layout.mjs';

const PRODUCT_CATEGORIES = [
  ['Live fish', 'live_fish'],
  ['Eggs', 'eggs'],
  ['3D printed', '3d_printed'],
  ['Food', 'food'],
  ['Bacteria / water care', 'bacteria_water_care'],
  ['Accessories', 'accessories'],
  ['Other', 'other'],
];

function slugify(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

function productGid(shopify, value) {
  const text = String(value ?? '').trim();
  if (text.startsWith('gid://shopify/Product/')) return text;
  if (/^\d+$/.test(text)) return shopify.gidForNumericProductId(text);
  throw new Error('Product ID must be a Shopify numeric product id or gid://shopify/Product/...');
}

function isOwner(interaction, config) {
  return interaction.user.id === config.discord.ownerUserId;
}

function isStaff(interaction) {
  return interaction.member?.roles?.cache?.some((role) => role.name === 'Aquaphoria Staff') ?? false;
}

function findTextChannel(guild, name) {
  return guild.channels.cache.find((channel) => channel.type === ChannelType.GuildText && channel.name === name) ?? null;
}

async function audit(guild, message) {
  const channel = findTextChannel(guild, '🧾・audit-log');
  if (channel) await channel.send(message).catch(() => undefined);
}

function commandDefinitions() {
  const aquaphoria = new SlashCommandBuilder()
    .setName('aquaphoria')
    .setDescription('Aquaphoria Discord administration')
    .addSubcommand((sub) => sub.setName('setup').setDescription('Create or synchronize the Aquaphoria Discord layout'));

  const vendor = new SlashCommandBuilder()
    .setName('vendor')
    .setDescription('Manage approved Aquaphoria vendors')
    .addSubcommand((sub) => sub
      .setName('add')
      .setDescription('Approve a breeder/vendor and create their private workspace')
      .addUserOption((option) => option.setName('user').setDescription('Discord user').setRequired(true))
      .addStringOption((option) => option.setName('name').setDescription('Breeder/vendor display name').setRequired(true).setMaxLength(80))
      .addStringOption((option) => option.setName('slug').setDescription('Catalog slug, e.g. toa').setRequired(false).setMaxLength(64)))
    .addSubcommand((sub) => sub.setName('list').setDescription('List configured Aquaphoria vendors'))
    .addSubcommand((sub) => sub
      .setName('disable')
      .setDescription('Disable a vendor without deleting order history')
      .addStringOption((option) => option.setName('vendor').setDescription('Vendor ID/slug').setRequired(true)));

  const catalog = new SlashCommandBuilder()
    .setName('catalog')
    .setDescription('Manage your Aquaphoria vendor catalog')
    .addSubcommand((sub) => {
      sub.setName('add').setDescription('Add or update one of your storefront products')
        .addStringOption((option) => option.setName('name').setDescription('Product or strain name').setRequired(true).setMaxLength(100))
        .addStringOption((option) => {
          option.setName('category').setDescription('Product category').setRequired(true);
          for (const [name, value] of PRODUCT_CATEGORIES) option.addChoices({ name, value });
          return option;
        })
        .addStringOption((option) => option.setName('price').setDescription('Your product price, e.g. 80.00').setRequired(true))
        .addStringOption((option) => option.setName('shipping').setDescription('Your shipping amount for this listing, e.g. 25.00').setRequired(true))
        .addIntegerOption((option) => option.setName('stock').setDescription('Quantity available').setRequired(true).setMinValue(0))
        .addStringOption((option) => option.setName('description').setDescription('Product details, lineage, size, materials, ingredients, etc.').setRequired(false).setMaxLength(1000))
        .addAttachmentOption((option) => option.setName('photo').setDescription('Actual product/fish photo').setRequired(false));
      return sub;
    })
    .addSubcommand((sub) => sub
      .setName('price')
      .setDescription('Change your base price and shipping; Aquaphoria markup recalculates automatically')
      .addStringOption((option) => option.setName('product_id').setDescription('Shopify product ID').setRequired(true))
      .addStringOption((option) => option.setName('price').setDescription('Your new product price').setRequired(true))
      .addStringOption((option) => option.setName('shipping').setDescription('Your new shipping amount').setRequired(true)))
    .addSubcommand((sub) => sub
      .setName('stock')
      .setDescription('Update stock for one of your products')
      .addStringOption((option) => option.setName('product_id').setDescription('Shopify product ID').setRequired(true))
      .addIntegerOption((option) => option.setName('quantity').setDescription('Available quantity').setRequired(true).setMinValue(0)))
    .addSubcommand((sub) => sub
      .setName('hide')
      .setDescription('Temporarily hide one of your products')
      .addStringOption((option) => option.setName('product_id').setDescription('Shopify product ID').setRequired(true)))
    .addSubcommand((sub) => sub
      .setName('show')
      .setDescription('Make one of your products active again')
      .addStringOption((option) => option.setName('product_id').setDescription('Shopify product ID').setRequired(true)))
    .addSubcommand((sub) => sub
      .setName('remove')
      .setDescription('Archive one of your products while preserving order history')
      .addStringOption((option) => option.setName('product_id').setDescription('Shopify product ID').setRequired(true)))
    .addSubcommand((sub) => sub.setName('list').setDescription('List products assigned to your vendor catalog'));

  const research = new SlashCommandBuilder()
    .setName('research')
    .setDescription('Research a strain or breeder and add verified work to Aquapedia')
    .addStringOption((option) => option
      .setName('type')
      .setDescription('What to research')
      .setRequired(true)
      .addChoices({ name: 'Strain', value: 'strain' }, { name: 'Breeder', value: 'breeder' }))
    .addStringOption((option) => option.setName('name').setDescription('Strain or breeder name').setRequired(true).setMaxLength(120));

  const order = new SlashCommandBuilder()
    .setName('order')
    .setDescription('Manage your Aquaphoria fulfillment tickets')
    .addSubcommand((sub) => sub.setName('list').setDescription('List your vendor fulfillment tickets'))
    .addSubcommand((sub) => sub
      .setName('view')
      .setDescription('View one of your vendor orders')
      .addStringOption((option) => option.setName('order').setDescription('Shopify order name, e.g. #1001').setRequired(true)))
    .addSubcommand((sub) => sub
      .setName('shipped')
      .setDescription('Mark your items shipped and send tracking to Shopify/customer')
      .addStringOption((option) => option.setName('order').setDescription('Shopify order name, e.g. #1001').setRequired(true))
      .addStringOption((option) => option.setName('tracking').setDescription('Tracking number').setRequired(true))
      .addStringOption((option) => option.setName('carrier').setDescription('Carrier, e.g. UPS, USPS, FedEx').setRequired(false)))
    .addSubcommand((sub) => sub
      .setName('issue')
      .setDescription('Flag a stock, shipping, DOA, delay, or fulfillment issue')
      .addStringOption((option) => option.setName('order').setDescription('Shopify order name, e.g. #1001').setRequired(true))
      .addStringOption((option) => option.setName('details').setDescription('What went wrong').setRequired(true).setMaxLength(1000)));

  const payout = new SlashCommandBuilder()
    .setName('payout')
    .setDescription('Aquaphoria vendor payout tools')
    .addSubcommand((sub) => sub.setName('status').setDescription('See what Aquaphoria owes you and what has been paid'))
    .addSubcommand((sub) => sub
      .setName('paid')
      .setDescription('Owner: mark a vendor order payout as sent')
      .addStringOption((option) => option.setName('vendor').setDescription('Vendor ID/slug').setRequired(true))
      .addStringOption((option) => option.setName('order').setDescription('Shopify order name, e.g. #1001').setRequired(true)));

  const ticket = new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Open a private Aquaphoria support ticket')
    .addSubcommand((sub) => sub
      .setName('open')
      .setDescription('Create a private customer support ticket')
      .addStringOption((option) => option
        .setName('type')
        .setDescription('Support topic')
        .setRequired(true)
        .addChoices(
          { name: 'Order', value: 'order' },
          { name: 'Shipping', value: 'shipping' },
          { name: 'DOA / livestock issue', value: 'doa' },
          { name: 'General', value: 'general' },
        ))
      .addStringOption((option) => option.setName('details').setDescription('Tell us what you need help with').setRequired(true).setMaxLength(1000)));

  return [aquaphoria, vendor, catalog, research, order, payout, ticket];
}

async function requireVendor(interaction, store) {
  const vendor = await store.getVendorByDiscordUser(interaction.user.id);
  if (!vendor) {
    await interaction.reply({ content: 'This command is only available to an approved Aquaphoria vendor.', ephemeral: true });
    return null;
  }
  return vendor;
}

async function handleSetup(interaction, deps) {
  if (!isOwner(interaction, deps.config)) return interaction.reply({ content: 'Only the Aquaphoria owner can run setup.', ephemeral: true });
  await interaction.deferReply({ ephemeral: true });
  const result = await provisionAquaphoriaLayout(interaction.guild, { ownerUserId: deps.config.discord.ownerUserId });
  await interaction.editReply(`✅ Aquaphoria layout synchronized: ${result.channels.length} core channels and vendor/staff roles are ready.`);
}

async function handleVendor(interaction, deps) {
  if (!isOwner(interaction, deps.config)) return interaction.reply({ content: 'Only the Aquaphoria owner can manage vendors.', ephemeral: true });
  const sub = interaction.options.getSubcommand();

  if (sub === 'list') {
    const vendors = await deps.store.listVendors();
    const body = vendors.length
      ? vendors.map((vendor) => `• **${vendor.displayName}** — \`${vendor.id}\` — <@${vendor.discordUserId}> — ${vendor.active ? 'active' : 'disabled'}`).join('\n')
      : 'No vendors configured yet.';
    return interaction.reply({ content: body, ephemeral: true });
  }

  if (sub === 'disable') {
    const id = interaction.options.getString('vendor', true);
    const current = await deps.store.getVendor(id);
    if (!current) return interaction.reply({ content: `Vendor \`${id}\` was not found.`, ephemeral: true });
    await deps.store.upsertVendor({ ...current, active: false });
    await audit(interaction.guild, `⛔ Vendor **${current.displayName}** (\`${id}\`) was disabled by <@${interaction.user.id}>.`);
    return interaction.reply({ content: `✅ Disabled **${current.displayName}**. Existing orders/history were preserved.`, ephemeral: true });
  }

  const user = interaction.options.getUser('user', true);
  const displayName = interaction.options.getString('name', true).trim();
  const id = slugify(interaction.options.getString('slug') || displayName);
  if (!id) return interaction.reply({ content: 'Could not create a valid vendor slug.', ephemeral: true });

  await interaction.deferReply({ ephemeral: true });
  const layout = await provisionAquaphoriaLayout(interaction.guild, { ownerUserId: deps.config.discord.ownerUserId });
  let saved = await deps.store.upsertVendor({ id, discordUserId: user.id, displayName, catalogSlug: id, active: true });
  const workspace = await ensureVendorWorkspace(interaction.guild, {
    vendor: saved,
    ownerUserId: deps.config.discord.ownerUserId,
    staffRoleId: layout.roles.staffRoleId,
  });
  saved = await deps.store.upsertVendor({ ...saved, discordRoleId: workspace.vendorRoleId });

  const member = await interaction.guild.members.fetch(user.id).catch(() => null);
  if (member) {
    await member.roles.add(layout.roles.vendorRoleId).catch(() => undefined);
    await member.roles.add(workspace.vendorRoleId).catch(() => undefined);
  }

  await audit(interaction.guild, `🐟 Approved vendor **${displayName}** (\`${id}\`) for <@${user.id}>.`);
  await interaction.editReply(`✅ **${displayName}** is now an Aquaphoria vendor with a private catalog/order workspace. Vendor ID: \`${id}\`.`);
}

async function handleCatalog(interaction, deps) {
  const vendor = await requireVendor(interaction, deps.store);
  if (!vendor) return;
  const sub = interaction.options.getSubcommand();
  await interaction.deferReply({ ephemeral: true });

  if (sub === 'add') {
    const vendorPriceCents = moneyToCents(interaction.options.getString('price', true));
    const vendorShippingCents = moneyToCents(interaction.options.getString('shipping', true));
    const result = await deps.catalog.add(vendor, {
      name: interaction.options.getString('name', true).trim(),
      category: interaction.options.getString('category', true),
      vendorPriceCents,
      vendorShippingCents,
      stock: interaction.options.getInteger('stock', true),
      description: interaction.options.getString('description') || '',
      imageUrl: interaction.options.getAttachment('photo')?.url ?? null,
      visible: true,
    });
    await audit(interaction.guild, `🛍️ **${vendor.displayName}** added/updated **${result.product.title}** • vendor $${centsToMoney(result.pricing.vendorPriceCents)} + shipping $${centsToMoney(result.pricing.vendorShippingCents)} + ${result.pricing.markupPercent}% = retail **$${centsToMoney(result.pricing.retailTotalCents)}** • \`${result.product.id}\``);
    return interaction.editReply(`✅ **${result.product.title}** synced to your Aquaphoria catalog.\nYour price: **$${centsToMoney(result.pricing.vendorPriceCents)}**\nYour shipping: **$${centsToMoney(result.pricing.vendorShippingCents)}**\nAquaphoria markup: **${result.pricing.markupPercent}%**\nCustomer retail: **$${centsToMoney(result.pricing.retailTotalCents)}**\nProduct ID: \`${result.product.id}\``);
  }

  if (sub === 'list') {
    const products = await deps.catalog.list(vendor);
    const text = products.length
      ? products.map((product) => `• **${product.title}** — ${product.status} — $${product.retailPrice ?? '?'} — stock ${product.inventoryQuantity ?? '?'} — \`${product.id}\``).join('\n')
      : 'Your vendor catalog is empty.';
    return interaction.editReply(text.slice(0, 1900));
  }

  const id = productGid(deps.shopify, interaction.options.getString('product_id', true));
  if (sub === 'price') {
    const pricing = await deps.catalog.updatePricing(vendor, id, {
      vendorPriceCents: moneyToCents(interaction.options.getString('price', true)),
      vendorShippingCents: moneyToCents(interaction.options.getString('shipping', true)),
    });
    await audit(interaction.guild, `💲 **${vendor.displayName}** repriced \`${id}\` • vendor $${centsToMoney(pricing.vendorPriceCents)} + shipping $${centsToMoney(pricing.vendorShippingCents)} + ${pricing.markupPercent}% = retail $${centsToMoney(pricing.retailTotalCents)}.`);
    return interaction.editReply(`✅ Price updated. Customer retail is now **$${centsToMoney(pricing.retailTotalCents)}**.`);
  }

  if (sub === 'stock') {
    const quantity = interaction.options.getInteger('quantity', true);
    await deps.catalog.setStock(vendor, id, quantity);
    await audit(interaction.guild, `📦 **${vendor.displayName}** changed stock for \`${id}\` to **${quantity}**.`);
    return interaction.editReply(`✅ Stock updated to **${quantity}**.`);
  }

  const status = sub === 'hide' ? 'DRAFT' : sub === 'show' ? 'ACTIVE' : 'ARCHIVED';
  const product = await deps.catalog.setStatus(vendor, id, status);
  await audit(interaction.guild, `${status === 'ACTIVE' ? '✅' : status === 'DRAFT' ? '🙈' : '🗄️'} **${vendor.displayName}** changed **${product.title}** to **${status}**.`);
  return interaction.editReply(`✅ **${product.title}** is now **${status}**.`);
}

async function handleResearch(interaction, deps) {
  const vendor = await deps.store.getVendorByDiscordUser(interaction.user.id);
  if (!isOwner(interaction, deps.config) && !isStaff(interaction) && !vendor) {
    return interaction.reply({ content: 'Aquapedia research commands are currently limited to Aquaphoria staff and approved vendors.', ephemeral: true });
  }
  await interaction.deferReply();
  const result = await deps.research.research({
    entityType: interaction.options.getString('type', true),
    name: interaction.options.getString('name', true),
    requestedBy: interaction.user.id,
  });

  if (result.status === 'completed') {
    const files = (result.files ?? []).map((file) => file.url ? `[${file.path}](${file.url})` : `\`${file.path}\``).join('\n');
    return interaction.editReply(`🧬 **Aquapedia research completed**\n${result.summary ?? 'Verified research was added.'}${result.duplicateOf ? `\nDuplicate/alias of: **${result.duplicateOf}**` : ''}${result.confidence ? `\nConfidence: **${result.confidence}**` : ''}${files ? `\n${files}` : ''}`.slice(0, 1950));
  }
  return interaction.editReply(`🔎 Research queued for Aquapedia verification. Job: \`${result.jobId}\`${result.url ? `\n${result.url}` : ''}`);
}

async function handleOrder(interaction, deps) {
  const vendor = await requireVendor(interaction, deps.store);
  if (!vendor) return;
  const sub = interaction.options.getSubcommand();

  if (sub === 'list') {
    const tickets = (await deps.store.listVendorTickets(vendor.id)).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    const text = tickets.length
      ? tickets.slice(0, 15).map((ticket) => `• **${ticket.orderName}** — ${ticket.status} — payout $${centsToMoney(ticket.payoutCents ?? 0)} — <#${ticket.channelId}>`).join('\n')
      : 'You have no Aquaphoria fulfillment tickets.';
    return interaction.reply({ content: text, ephemeral: true });
  }

  const orderName = interaction.options.getString('order', true);
  if (sub === 'view') {
    const ticket = await deps.store.findVendorTicketByOrderName(vendor.id, orderName);
    if (!ticket) return interaction.reply({ content: `No ${orderName} ticket belongs to your vendor account.`, ephemeral: true });
    return interaction.reply({ content: `**${ticket.orderName}** • ${ticket.status} • payout $${centsToMoney(ticket.payoutCents ?? 0)} • <#${ticket.channelId}>${ticket.trackingNumber ? ` • tracking ${ticket.trackingNumber}` : ''}`, ephemeral: true });
  }

  await interaction.deferReply({ ephemeral: true });
  if (sub === 'shipped') {
    const updated = await deps.orders.markShipped(interaction.guild, {
      vendorId: vendor.id,
      orderName,
      trackingNumber: interaction.options.getString('tracking', true),
      trackingCompany: interaction.options.getString('carrier') || null,
    });
    return interaction.editReply(`✅ **${updated.orderName}** marked shipped. Shopify/customer tracking notification was requested.`);
  }

  await deps.orders.reportIssue(interaction.guild, {
    vendorId: vendor.id,
    orderName,
    issue: interaction.options.getString('details', true),
  });
  return interaction.editReply(`🚨 Issue flagged for **${orderName}**. Aquaphoria staff has been notified.`);
}

async function handlePayout(interaction, deps) {
  const sub = interaction.options.getSubcommand();
  if (sub === 'status') {
    const vendor = await requireVendor(interaction, deps.store);
    if (!vendor) return;
    const summary = await deps.store.payoutSummary(vendor.id);
    return interaction.reply({
      content: `💰 **${vendor.displayName} payout status**\nOwed: **$${centsToMoney(summary.owedCents)}**\nPaid: **$${centsToMoney(summary.paidCents)}**\nCurrent balance: **$${centsToMoney(summary.balanceCents)}**`,
      ephemeral: true,
    });
  }

  if (!isOwner(interaction, deps.config)) return interaction.reply({ content: 'Only the Aquaphoria owner can mark payouts paid.', ephemeral: true });
  const vendorId = interaction.options.getString('vendor', true);
  const orderName = interaction.options.getString('order', true);
  const vendor = await deps.store.getVendor(vendorId);
  if (!vendor) return interaction.reply({ content: `Vendor \`${vendorId}\` not found.`, ephemeral: true });
  const ticket = await deps.store.findVendorTicketByOrderName(vendorId, orderName);
  if (!ticket) return interaction.reply({ content: `No ${orderName} ticket belongs to ${vendor.displayName}.`, ephemeral: true });

  await deps.store.appendPayout({
    id: `paid:${ticket.orderId}:${vendorId}`,
    vendorId,
    orderId: ticket.orderId,
    amountCents: ticket.payoutCents ?? 0,
    type: 'paid',
    note: `Payout sent for ${ticket.orderName}`,
  });
  await deps.store.recordTicket({ ...ticket, payoutStatus: 'paid', payoutPaidAt: new Date().toISOString() });
  const ticketChannel = interaction.guild.channels.cache.get(ticket.channelId);
  if (ticketChannel?.isTextBased()) await ticketChannel.send(`💰 Aquaphoria marked the vendor payout of **$${centsToMoney(ticket.payoutCents ?? 0)}** as sent.`);
  const payoutLog = findTextChannel(interaction.guild, '💳・payout-log');
  if (payoutLog) await payoutLog.send(`💰 Paid **${vendor.displayName}** $${centsToMoney(ticket.payoutCents ?? 0)} for **${ticket.orderName}**.`);
  return interaction.reply({ content: `✅ Marked **${ticket.orderName}** payout to **${vendor.displayName}** as paid.`, ephemeral: true });
}

async function handleSupportTicket(interaction, deps) {
  const type = interaction.options.getString('type', true);
  const details = interaction.options.getString('details', true);
  const layout = await provisionAquaphoriaLayout(interaction.guild, { ownerUserId: deps.config.discord.ownerUserId });
  const supportCategory = interaction.guild.channels.cache.find((channel) => channel.type === ChannelType.GuildCategory && channel.name === '🎫・CUSTOMER SUPPORT');
  if (!supportCategory) throw new Error('Customer support category is missing');

  const channel = await interaction.guild.channels.create({
    name: `ticket-${type}-${slugify(interaction.user.username).slice(0, 25)}`,
    type: ChannelType.GuildText,
    parent: supportCategory.id,
    permissionOverwrites: [
      { id: interaction.guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
      { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
      { id: deps.config.discord.ownerUserId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
      { id: layout.roles.staffRoleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
    ],
    topic: `Aquaphoria customer support • ${type} • opened by ${interaction.user.id}`,
    reason: 'Aquaphoria customer support ticket',
  });
  const embed = new EmbedBuilder()
    .setTitle(`🎫 ${type.toUpperCase()} Support Ticket`)
    .setDescription(details)
    .addFields({ name: 'Customer', value: `<@${interaction.user.id}>` })
    .setTimestamp();
  await channel.send({ content: `<@${interaction.user.id}> Aquaphoria staff will help you here.`, embeds: [embed] });
  await audit(interaction.guild, `🎫 Customer ticket opened by <@${interaction.user.id}> • type **${type}** • <#${channel.id}>`);
  return interaction.reply({ content: `✅ Your private Aquaphoria ticket is ready: <#${channel.id}>`, ephemeral: true });
}

export async function registerGuildCommands(guild) {
  return guild.commands.set(commandDefinitions().map((command) => command.toJSON()));
}

export async function handleInteraction(interaction, deps) {
  if (!interaction.isChatInputCommand() || !interaction.inGuild()) return;
  try {
    if (interaction.commandName === 'aquaphoria') return await handleSetup(interaction, deps);
    if (interaction.commandName === 'vendor') return await handleVendor(interaction, deps);
    if (interaction.commandName === 'catalog') return await handleCatalog(interaction, deps);
    if (interaction.commandName === 'research') return await handleResearch(interaction, deps);
    if (interaction.commandName === 'order') return await handleOrder(interaction, deps);
    if (interaction.commandName === 'payout') return await handlePayout(interaction, deps);
    if (interaction.commandName === 'ticket') return await handleSupportTicket(interaction, deps);
  } catch (error) {
    console.error('Command failed', interaction.commandName, error);
    const content = `❌ ${error.message ?? 'Command failed'}`.slice(0, 1900);
    if (interaction.deferred || interaction.replied) await interaction.editReply({ content }).catch(() => undefined);
    else await interaction.reply({ content, ephemeral: true }).catch(() => undefined);
  }
}

export { commandDefinitions };
