import {
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import { calculateRetailBreakdown, centsToMoney, moneyToCents } from './pricing.mjs';
import { ensureVendorWorkspace, provisionAquaphoriaLayout } from './layout.mjs';
import {
  getCanonicalStaffRole,
  isCanonicalStaff,
  revokeVendorAccess,
} from './authorization.mjs';

const PRODUCT_CATEGORIES = [
  ['Live fish', 'live_fish'],
  ['Eggs', 'eggs'],
  ['3D printed', '3d_printed'],
  ['Food', 'food'],
  ['Bacteria / water care', 'bacteria_water_care'],
  ['Accessories', 'accessories'],
  ['Other', 'other'],
];
const PRODUCT_SUBMISSION_TEMPLATES = Object.freeze({
  livestock: [
    'Product/strain name:',
    'Japanese/common name:',
    'Species/genus:',
    'Product format: individual / pair / trio / group / other',
    'Quantity available:',
    'Sex/ratio:',
    'Size/age:',
    'Vendor price:',
    'Vendor shipping:',
    'Lineage / breeder attribution:',
    'Origin / source notes:',
    'Description / traits:',
    'Shipping origin:',
    'Shipping notes:',
    'DOA policy:',
    'Needs Aquapedia research? yes/no:',
    'Extra notes:',
  ].join('\n'),
  eggs: [
    'Species/strain:', 'Egg count or pack size:', 'Quantity of packs available:',
    'Vendor price:', 'Vendor shipping:', 'Breeder/lineage:',
    'Collection/lay date or freshness notes:', 'Incubation/shipping notes:',
    'DOA/hatch policy:', 'Needs Aquapedia research? yes/no:', 'Extra notes:',
  ].join('\n'),
  food: [
    'Product name:', 'Brand/maker:', 'Size / weight / volume:', 'Quantity available:',
    'Vendor price:', 'Vendor shipping:', 'Ingredients or active contents:',
    'Storage instructions:', 'Batch / manufacture / expiry information:',
    'Usage description:', 'Extra notes:',
  ].join('\n'),
  '3d_printed': [
    'Product name:', 'Product type:', 'Material:', 'Dimensions:', 'Available options:',
    'Quantity available:', 'Made to order? yes/no:', 'Vendor price:', 'Vendor shipping:',
    'Description/specifications:', 'Extra notes:',
  ].join('\n'),
  bacteria_water_care: [
    'Product name:', 'Brand/maker:', 'Size / weight / volume:', 'Quantity available:',
    'Vendor price:', 'Vendor shipping:', 'Ingredients or active contents:',
    'Storage instructions:', 'Batch / manufacture / expiry information:',
    'Usage description:', 'Extra notes:',
  ].join('\n'),
  accessories: [
    'Product name:', 'Product type:', 'Material:', 'Dimensions:', 'Available options:',
    'Quantity available:', 'Vendor price:', 'Vendor shipping:',
    'Description/specifications:', 'Extra notes:',
  ].join('\n'),
  other: [
    'Product name:', 'Product type:', 'Quantity available:', 'Vendor price:', 'Vendor shipping:',
    'Description:', 'Shipping origin:', 'Shipping notes:', 'Extra notes:',
  ].join('\n'),
});

export function productSubmissionTemplate(type) {
  const template = PRODUCT_SUBMISSION_TEMPLATES[String(type ?? '').trim().toLowerCase()];
  if (!template) throw new Error('Unsupported product submission type');
  return template;
}

const REQUIRED_PRODUCT_FIELDS = Object.freeze({
  livestock: ['Product/strain name', 'Quantity available', 'Vendor price', 'Vendor shipping', 'Shipping origin', 'DOA policy'],
  eggs: ['Species/strain', 'Egg count or pack size', 'Quantity of packs available', 'Vendor price', 'Vendor shipping', 'DOA/hatch policy'],
  food: ['Product name', 'Size / weight / volume', 'Quantity available', 'Vendor price', 'Vendor shipping'],
  bacteria_water_care: ['Product name', 'Size / weight / volume', 'Quantity available', 'Vendor price', 'Vendor shipping'],
  '3d_printed': ['Product name', 'Product type', 'Material', 'Dimensions', 'Quantity available', 'Made to order? yes/no', 'Vendor price', 'Vendor shipping'],
  accessories: ['Product name', 'Product type', 'Quantity available', 'Vendor price', 'Vendor shipping'],
  other: ['Product name', 'Product type', 'Quantity available', 'Vendor price', 'Vendor shipping'],
});

export function parseProductSubmission(type, text) {
  const normalizedType = String(type ?? '').trim().toLowerCase();
  productSubmissionTemplate(normalizedType);
  const fields = {};
  for (const rawLine of String(text ?? '').split(/\r?\n/)) {
    const separator = rawLine.indexOf(':');
    if (separator < 1) continue;
    const label = rawLine.slice(0, separator).trim().toLowerCase();
    if (!label) continue;
    fields[label] = rawLine.slice(separator + 1).trim();
  }
  const required = REQUIRED_PRODUCT_FIELDS[normalizedType] ?? [];
  const missing = required.filter((label) => !fields[label.toLowerCase()]);
  return Object.freeze({ type: normalizedType, fields: Object.freeze(fields), missing: Object.freeze(missing), complete: missing.length === 0 });
}

const PRODUCT_TYPE_TO_CATEGORY = Object.freeze({
  livestock: 'live_fish', eggs: 'eggs', food: 'food', bacteria_water_care: 'bacteria_water_care',
  '3d_printed': '3d_printed', accessories: 'accessories', other: 'other',
});

export function buildProductSubmissionPreview(submission, markupPercent) {
  if (!submission?.complete) throw new Error(`Product submission is incomplete: ${(submission?.missing ?? []).join(', ')}`);
  const fields = submission.fields ?? {};
  const type = submission.type;
  const nameKey = type === 'livestock' ? 'product/strain name' : type === 'eggs' ? 'species/strain' : 'product name';
  const quantityKey = type === 'eggs' ? 'quantity of packs available' : 'quantity available';
  const stockText = String(fields[quantityKey] ?? '').trim();
  if (!/^\d+$/.test(stockText)) throw new Error('Quantity available must be a non-negative integer');
  const stock = Number.parseInt(stockText, 10);
  if (!Number.isSafeInteger(stock)) throw new Error('Quantity available must be a non-negative integer');
  const vendorPriceCents = moneyToCents(fields['vendor price']);
  const vendorShippingCents = moneyToCents(fields['vendor shipping']);
  const pricing = calculateRetailBreakdown({ vendorPriceCents, vendorShippingCents, markupPercent });
  let description = fields['description / traits'] ?? fields['description/specifications'] ?? fields.description ?? fields['usage description'] ?? '';
  const madeToOrderText = String(fields['made to order? yes/no'] ?? '').trim().toLowerCase();
  const madeToOrder = type === '3d_printed' && ['yes', 'y', 'true'].includes(madeToOrderText);
  if (type === '3d_printed') description = `${description}${description ? '\n\n' : ''}Made to order: ${madeToOrder ? 'Yes' : 'No'}`;
  const media = Array.isArray(submission.media) ? submission.media : [];
  const imageMedia = media.find((entry) => {
    const contentType = String(entry?.contentType ?? '').trim().toLowerCase();
    if (contentType) return contentType.startsWith('image/');
    return /\.(?:png|jpe?g|webp|gif)(?:[?#]|$)/i.test(String(entry?.url ?? ''));
  });
  const research = String(fields['needs aquapedia research? yes/no'] ?? '').trim().toLowerCase();
  return Object.freeze({
    product: Object.freeze({ name: fields[nameKey], category: PRODUCT_TYPE_TO_CATEGORY[type], stock, madeToOrder, description, imageUrl: imageMedia?.url ?? null }),
    pricing,
    needsAquapediaResearch: ['yes', 'y', 'true'].includes(research),
  });
}

async function queueApprovedSubmissionResearch(interaction, deps, { submission, preview, submitterDiscordId, ticketChannel }) {
  if (!preview?.needsAquapediaResearch) return '';
  if (typeof deps?.research?.research !== 'function') {
    if (ticketChannel) {
      await ticketChannel
        .send('🔬 The partner requested Aquapedia research, but the research service is not configured. Run `/research` manually; the storefront listing is unaffected.')
        .catch(() => undefined);
    }
    return '\n🔬 Aquapedia research was requested but the research service is not configured; run `/research` manually.';
  }
  const researchName = String(preview.product?.name ?? '').trim();
  if (!researchName) return '';
  try {
    const result = await deps.research.research({
      entityType: 'strain',
      name: researchName,
      requestedBy: submitterDiscordId,
    });
    const completed = result?.status === 'completed';
    const jobSuffix = result?.jobId ? ` (job \`${result.jobId}\`)` : '';
    if (ticketChannel) {
      await ticketChannel
        .send(`🔬 Aquapedia research ${completed ? 'completed' : 'queued'} for **${researchName}**${jobSuffix}. Verified research will not overwrite the storefront listing.`)
        .catch(() => undefined);
    }
    await deps.store
      .saveProductSubmission(
        { ...submission, aquapediaResearchJobId: result?.jobId ?? null, aquapediaResearchStatus: result?.status ?? 'queued' },
        { expectedStatuses: ['approved'] },
      )
      .catch(() => undefined);
    await audit(
      interaction.guild,
      `🔬 Aquapedia research ${completed ? 'completed' : 'queued'} for approved submission \`${submission.id}\` (${researchName})${jobSuffix}.`,
    ).catch(() => undefined);
    return `\n🔬 Aquapedia research ${completed ? 'completed' : 'queued'} for **${researchName}**${jobSuffix}.`;
  } catch (error) {
    const reason = String(error?.message ?? error).slice(0, 200);
    if (ticketChannel) {
      await ticketChannel
        .send(`⚠️ Aquapedia research could not be queued automatically (${reason}). The storefront listing is unaffected; run \`/research\` manually.`)
        .catch(() => undefined);
    }
    await audit(interaction.guild, `⚠️ Aquapedia research auto-queue failed for \`${submission.id}\`: ${reason}`).catch(() => undefined);
    return '\n⚠️ Aquapedia research could not be queued automatically; run `/research` manually.';
  }
}

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
      .setDescription('Approve a breeder/vendor and assign the catalog they control')
      .addUserOption((option) => option.setName('user').setDescription('Discord user').setRequired(true))
      .addStringOption((option) => option.setName('name').setDescription('Breeder/vendor display name').setRequired(true).setMaxLength(80))
      .addStringOption((option) => option.setName('catalog').setDescription('Catalog they may control, e.g. toa, mimu, shrimp-supply').setRequired(true).setMaxLength(64))
      .addStringOption((option) => option.setName('vendor_id').setDescription('Optional internal vendor ID; defaults to breeder/vendor name').setRequired(false).setMaxLength(64)))
    .addSubcommand((sub) => sub.setName('list').setDescription('List configured Aquaphoria vendors and their assigned catalogs'))
    .addSubcommand((sub) => sub
      .setName('disable')
      .setDescription('Disable a vendor without deleting order history')
      .addStringOption((option) => option.setName('vendor').setDescription('Vendor ID').setRequired(true)));

  const catalog = new SlashCommandBuilder()
    .setName('catalog')
    .setDescription('Manage your assigned Aquaphoria vendor catalog')
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

  const product = new SlashCommandBuilder()
    .setName('product')
    .setDescription('Submit and review Aquaphoria partner products')
    .addSubcommand((sub) => sub.setName('submit').setDescription('Start a guided private product submission')
      .addStringOption((option) => option.setName('type').setDescription('What are you listing?').setRequired(true).addChoices(
        { name: 'Live fish / shrimp', value: 'livestock' }, { name: 'Eggs', value: 'eggs' },
        { name: 'Food', value: 'food' }, { name: 'Bacteria / water care', value: 'bacteria_water_care' },
        { name: '3D printed product', value: '3d_printed' }, { name: 'Accessory', value: 'accessories' },
        { name: 'Other approved product', value: 'other' },
      )))
    .addSubcommand((sub) => sub.setName('fill').setDescription('Fill or update your pending product draft')
      .addStringOption((option) => option.setName('submission').setDescription('Submission ID from the ticket').setRequired(true))
      .addStringOption((option) => option.setName('details').setDescription('Paste the completed template').setRequired(true).setMaxLength(6000))
      .addAttachmentOption((option) => option.setName('media').setDescription('Optional actual product photo/video').setRequired(false)))
    .addSubcommand((sub) => sub.setName('review').setDescription('Staff: review a pending product draft')
      .addStringOption((option) => option.setName('submission').setDescription('Submission ID').setRequired(true))
      .addStringOption((option) => option.setName('action').setDescription('Decision').setRequired(true).addChoices(
        { name: 'Approve & sync', value: 'approve' }, { name: 'Request changes', value: 'request_changes' }, { name: 'Reject', value: 'reject' },
      ))
      .addStringOption((option) => option.setName('notes').setDescription('Optional staff notes').setRequired(false).setMaxLength(1000)));
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
      .addStringOption((option) => option.setName('vendor').setDescription('Vendor ID').setRequired(true))
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

  return [aquaphoria, vendor, catalog, product, research, order, payout, ticket];
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
  const result = await provisionAquaphoriaLayout(interaction.guild, {
    ownerUserId: deps.config.discord.ownerUserId,
    store: deps.store,
  });
  await interaction.editReply(`✅ Aquaphoria layout synchronized: ${result.channels.length} core channels and vendor/staff roles are ready.`);
}

async function handleVendor(interaction, deps) {
  if (!isOwner(interaction, deps.config)) return interaction.reply({ content: 'Only the Aquaphoria owner can manage vendors.', ephemeral: true });
  const sub = interaction.options.getSubcommand();

  if (sub === 'list') {
    const vendors = await deps.store.listVendors();
    const body = vendors.length
      ? vendors.map((vendor) => `• **${vendor.displayName}** — vendor \`${vendor.id}\` — catalog \`${vendor.catalogSlug}\` — <@${vendor.discordUserId}> — ${vendor.active ? 'active' : 'disabled'}`).join('\n')
      : 'No vendors configured yet.';
    return interaction.reply({ content: body, ephemeral: true });
  }

  if (sub === 'disable') {
    const id = interaction.options.getString('vendor', true);
    const current = await deps.store.getVendor(id);
    if (!current) return interaction.reply({ content: `Vendor \`${id}\` was not found.`, ephemeral: true });
    const revoked = await revokeVendorAccess(interaction.guild, current, deps.store);
    await deps.store.upsertVendor({ ...current, active: false });
    await audit(interaction.guild, `⛔ Vendor **${current.displayName}** (\`${id}\`) was disabled by <@${interaction.user.id}>.`);
    return interaction.reply({
      content: `✅ Disabled **${current.displayName}** and revoked ${revoked.removedRoleIds.length} vendor role(s). Existing orders/history were preserved.`,
      ephemeral: true,
    });
  }

  const user = interaction.options.getUser('user', true);
  const displayName = interaction.options.getString('name', true).trim();
  const id = slugify(interaction.options.getString('vendor_id') || displayName);
  const catalogSlug = slugify(interaction.options.getString('catalog', true));
  if (!id || !catalogSlug) return interaction.reply({ content: 'Could not create a valid vendor ID/catalog name.', ephemeral: true });

  const vendors = await deps.store.listVendors();
  const catalogOwner = vendors.find((entry) => entry.active !== false && entry.catalogSlug === catalogSlug && entry.discordUserId !== user.id);
  if (catalogOwner) {
    return interaction.reply({
      content: `Catalog \`${catalogSlug}\` is already assigned to **${catalogOwner.displayName}**. Disable/reassign that vendor first rather than sharing storefront write access.`,
      ephemeral: true,
    });
  }

  await interaction.deferReply({ ephemeral: true });
  const layout = await provisionAquaphoriaLayout(interaction.guild, { ownerUserId: deps.config.discord.ownerUserId, store: deps.store });
  let saved = await deps.store.upsertVendor({ id, discordUserId: user.id, displayName, catalogSlug, active: true });
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

  await audit(interaction.guild, `🐟 Approved vendor **${displayName}** (\`${id}\`) for <@${user.id}> with catalog \`${catalogSlug}\`.`);
  await interaction.editReply(`✅ **${displayName}** is now an Aquaphoria vendor.\nVendor ID: \`${id}\`\nAssigned catalog: \`${catalogSlug}\`\nThey can manage only products owned by this vendor/catalog through the vendor portal.`);
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
    return interaction.editReply(`✅ **${result.product.title}** synced to catalog \`${vendor.catalogSlug}\`.\nYour price: **$${centsToMoney(result.pricing.vendorPriceCents)}**\nYour shipping: **$${centsToMoney(result.pricing.vendorShippingCents)}**\nAquaphoria markup: **${result.pricing.markupPercent}%**\nCustomer retail: **$${centsToMoney(result.pricing.retailTotalCents)}**\nProduct ID: \`${result.product.id}\``);
  }

  if (sub === 'list') {
    const products = await deps.catalog.list(vendor);
    const text = products.length
      ? `Catalog: \`${vendor.catalogSlug}\`\n${products.map((product) => `• **${product.title}** — ${product.status} — $${product.retailPrice ?? '?'} — stock ${product.inventoryQuantity ?? '?'} — \`${product.id}\``).join('\n')}`
      : `Catalog \`${vendor.catalogSlug}\` is empty.`;
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

async function handleProduct(interaction, deps) {
  const sub = interaction.options.getSubcommand();

  if (sub === 'fill') {
    const vendor = await requireVendor(interaction, deps.store);
    if (!vendor) return;
    const id = interaction.options.getString('submission', true);
    const submission = await deps.store.getProductSubmission(id);
    if (!submission) return interaction.reply({ content: `Product submission \`${id}\` was not found.`, ephemeral: true });
    if (submission.vendorId !== vendor.id) throw new Error('This product submission belongs to another vendor');
    if (['approved', 'rejected', 'approval_processing'].includes(submission.status)) throw new Error(`Product submission is already ${submission.status}`);

    await interaction.deferReply({ ephemeral: true });
    const update = parseProductSubmission(submission.type, interaction.options.getString('details', true));
    const mergedFields = { ...(submission.fields ?? {}), ...update.fields };
    const parsed = parseProductSubmission(submission.type, Object.entries(mergedFields).map(([label, value]) => `${label}: ${value}`).join('\n'));
    const attachment = interaction.options.getAttachment('media');
    const media = [...(submission.media ?? [])];
    if (attachment?.url && !media.some((entry) => entry.url === attachment.url)) {
      media.push({ url: attachment.url, name: attachment.name ?? null, contentType: attachment.contentType ?? null });
    }
    const status = parsed.complete ? 'pending' : 'draft';
    let preview = null;
    if (parsed.complete) preview = buildProductSubmissionPreview({ ...parsed, media }, deps.config.marketplace.defaultMarkupPercent);
    const saved = await deps.store.saveProductSubmission({
      ...submission, fields: parsed.fields, missing: parsed.missing, media, status,
      pricing: preview?.pricing ?? null, needsAquapediaResearch: preview?.needsAquapediaResearch ?? false,
    }, { expectedStatuses: [submission.status] });
    const ticketChannel = interaction.guild.channels.cache.find((channel) => channel.id === saved.ticketChannelId);
    if (!parsed.complete) {
      const missing = parsed.missing.join(', ');
      if (ticketChannel) await ticketChannel.send(`📝 Draft saved. Still needed: **${missing}**.`);
      return interaction.editReply(`📝 Saved. I still need: **${missing}**. Paste the updated format into \`/product fill\` when ready.`);
    }
    const text = `🧾 **Product Preview**\n**${preview.product.name}** • stock ${preview.product.stock}\nVendor product: **$${centsToMoney(preview.pricing.vendorPriceCents)}**\nVendor shipping: **$${centsToMoney(preview.pricing.vendorShippingCents)}**\nAquaphoria markup: **${preview.pricing.markupPercent}%**\nCustomer retail: **$${centsToMoney(preview.pricing.retailTotalCents)}**${preview.needsAquapediaResearch ? '\n🔬 Aquapedia research requested.' : ''}\n\nStatus: **PENDING REVIEW**`;
    if (ticketChannel) await ticketChannel.send(text);
    await audit(interaction.guild, `🧾 **${vendor.displayName}** completed product submission \`${id}\`; pending staff review.`);
    return interaction.editReply('✅ Product details saved and the preview is **pending review** in your private ticket.');
  }

  if (sub === 'review') {
    const staff = await isCanonicalStaff(interaction, deps.store);
    if (!isOwner(interaction, deps.config) && !staff) {
      return interaction.reply({ content: 'Only Aquaphoria staff can review product submissions.', ephemeral: true });
    }
    const id = interaction.options.getString('submission', true);
    const action = interaction.options.getString('action', true);
    const notes = interaction.options.getString('notes') || null;
    const submission = await deps.store.getProductSubmission(id);
    if (!submission) return interaction.reply({ content: `Product submission \`${id}\` was not found.`, ephemeral: true });
    if (submission.status === 'approved') {
      if (action === 'approve') {
        return interaction.reply({ content: submission.shopifyProductId
          ? `ℹ️ Product submission \`${id}\` is already approved as \`${submission.shopifyProductId}\`.`
          : `ℹ️ Product submission \`${id}\` is already approved.`, ephemeral: true });
      }
      throw new Error('Product submission is already approved and cannot be reviewed again');
    }
    if (['request_changes', 'reject'].includes(action)) {
      if (submission.status !== 'pending') throw new Error('Only pending product submissions can be reviewed');
      await interaction.deferReply({ ephemeral: true });
      const status = action === 'request_changes' ? 'changes_requested' : 'rejected';
      const saved = await deps.store.saveProductSubmission({
        ...submission, status, reviewNotes: notes,
        reviewedBy: interaction.user.id, reviewedAt: new Date().toISOString(),
      }, { expectedStatuses: ['pending'] });
      const ticketChannel = interaction.guild.channels.cache.find((channel) => channel.id === saved.ticketChannelId);
      const label = status === 'changes_requested' ? '📝 **CHANGES REQUESTED**' : '❌ **REJECTED**';
      if (ticketChannel) await ticketChannel.send(`${label}${notes ? `\n${notes}` : ''}`);
      await audit(interaction.guild, `${label} for product submission \`${id}\` by <@${interaction.user.id}>.`);
      return interaction.editReply(status === 'changes_requested'
        ? `📝 Changes requested for \`${id}\`. The partner can update it with \`/product fill\`.`
        : `❌ Product submission \`${id}\` rejected.`);
    }
    if (action !== 'approve') throw new Error('Unsupported product review action');

    await interaction.deferReply({ ephemeral: true });
    const claim = await deps.store.claimProductApproval(id);
    if (!claim.claimed) {
      if (claim.reason === 'approved') {
        const productId = claim.existing?.shopifyProductId;
        return interaction.editReply(productId
          ? `ℹ️ Product submission \`${id}\` is already approved as \`${productId}\`.`
          : `ℹ️ Product submission \`${id}\` is already approved.`);
      }
      if (claim.reason === 'processing') return interaction.editReply(`⏳ Product submission \`${id}\` is already being approved. Try again after the current approval finishes.`);
      if (claim.reason === 'reconciliation_required') return interaction.editReply(`⚠️ Product submission \`${id}\` needs Shopify reconciliation before approval can be retried.`);
      throw new Error('Only pending product submissions can be approved');
    }
    const claimedSubmission = claim.record;
    let preview;
    let vendor;
    try {
      const canonicalText = Object.entries(claimedSubmission.fields ?? {}).map(([label, value]) => `${label}: ${value}`).join('\n');
      const parsed = parseProductSubmission(claimedSubmission.type, canonicalText);
      preview = buildProductSubmissionPreview({ ...parsed, media: claimedSubmission.media ?? [] }, deps.config.marketplace.defaultMarkupPercent);
      vendor = await deps.store.getVendor(claimedSubmission.vendorId);
      if (!vendor || vendor.active === false) throw new Error('Submission vendor is missing or disabled');
      await deps.store.markProductApprovalPublishing(id, { approvalAttempt: claimedSubmission.approvalAttempt });
    } catch (error) {
      await deps.store.failProductApproval(id, error, { approvalAttempt: claimedSubmission.approvalAttempt }).catch(() => undefined);
      throw error;
    }
    let synced;
    try {
      synced = await deps.catalog.add(vendor, { ...preview.product, vendorPriceCents: preview.pricing.vendorPriceCents, vendorShippingCents: preview.pricing.vendorShippingCents, visible: true });
    } catch (error) {
      await deps.store.failProductApproval(id, error, { approvalAttempt: claimedSubmission.approvalAttempt }).catch(() => undefined);
      throw error;
    }
    let saved;
    try {
      saved = await deps.store.completeProductApproval(id, {
        shopifyProductId: synced.product.id, shopifyHandle: synced.product.handle ?? null,
        pricing: synced.pricing, needsAquapediaResearch: preview.needsAquapediaResearch,
        reviewNotes: notes, reviewedBy: interaction.user.id, reviewedAt: new Date().toISOString(),
      }, { approvalAttempt: claimedSubmission.approvalAttempt });
    } catch (error) {
      throw new Error(`Shopify synced product ${synced.product.id} but local approval completion failed; reconciliation required: ${error?.message ?? error}`);
    }
    const ticketChannel = interaction.guild.channels.cache.find((channel) => channel.id === saved.ticketChannelId);
    const approvalMessage = `✅ **APPROVED** — **${synced.product.title}** synced to Shopify. Product ID: \`${synced.product.id}\`${synced.product.handle ? ` • handle \`${synced.product.handle}\`` : ''}`;
    if (ticketChannel) await ticketChannel.send(approvalMessage);
    const vendorCategory = interaction.guild.channels.cache.find((channel) => channel.type === ChannelType.GuildCategory && channel.name === `🐟・${vendor.displayName.toUpperCase()} HQ`);
    const vendorCatalogChannel = vendorCategory ? interaction.guild.channels.cache.find((channel) => channel.type === ChannelType.GuildText && channel.name === '🛍️・catalog' && channel.parentId === vendorCategory.id) : null;
    if (vendorCatalogChannel) await vendorCatalogChannel.send(approvalMessage).catch(() => undefined);
    await audit(interaction.guild, `✅ Product submission \`${id}\` approved by <@${interaction.user.id}> and synced as \`${synced.product.id}\`.`);
    const researchNote = await queueApprovedSubmissionResearch(interaction, deps, {
      submission: saved,
      preview,
      submitterDiscordId: claimedSubmission.submitterDiscordId,
      ticketChannel,
    });
    return interaction.editReply(`✅ Approved **${synced.product.title}** and synced it to Shopify as \`${synced.product.id}\`.${researchNote}`);
  }

  if (sub !== 'submit') throw new Error('Product submission action is not implemented yet');
  const vendor = await requireVendor(interaction, deps.store);
  if (!vendor) return;
  const type = interaction.options.getString('type', true);
  const template = productSubmissionTemplate(type);
  const staffRole = await getCanonicalStaffRole(interaction.guild, deps.store);
  if (!staffRole) return interaction.reply({ content: 'Aquaphoria partner submissions are not configured yet.', ephemeral: true });
  const supportCategory = interaction.guild.channels.cache.find((channel) => channel.type === ChannelType.GuildCategory && channel.name === '🎫・CUSTOMER SUPPORT');
  if (!supportCategory) return interaction.reply({ content: 'Aquaphoria product submission tickets are not configured yet.', ephemeral: true });

  await interaction.deferReply({ ephemeral: true });
  const channel = await interaction.guild.channels.create({
    name: `product-${vendor.id}-${String(interaction.id).slice(-6)}`.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 90),
    type: ChannelType.GuildText,
    parent: supportCategory.id,
    permissionOverwrites: [
      { id: interaction.guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
      { id: deps.config.discord.ownerUserId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
      { id: staffRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
      { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
    ],
    reason: `Aquaphoria product submission for vendor ${vendor.id}`,
  });
  const id = `product:${interaction.id}`;
  const initial = parseProductSubmission(type, '');
  await deps.store.saveProductSubmission({
    id, vendorId: vendor.id, submitterDiscordId: interaction.user.id, type,
    status: 'draft', fields: {}, media: [], missing: initial.missing, ticketChannelId: channel.id,
  });
  await channel.send({ content: `🛍️ **Aquaphoria Product Submission**\nSubmission ID: \`${id}\`\n\nCopy this format, fill it in, then run \`/product fill\` with the same submission ID and paste the completed format into **details**. You can attach an actual photo/video in **media**. For shipping origin, use city/state or country only—never a private street address.\n\n\`\`\`text\n${template}\n\`\`\`` });
  await audit(interaction.guild, `🛍️ **${vendor.displayName}** opened product submission \`${id}\` in <#${channel.id}>.`);
  return interaction.editReply(`✅ Your private product submission ticket is ready: <#${channel.id}>\nSubmission ID: \`${id}\``);
}

async function handleResearch(interaction, deps) {
  const vendor = await deps.store.getVendorByDiscordUser(interaction.user.id);
  const staff = await isCanonicalStaff(interaction, deps.store);
  if (!isOwner(interaction, deps.config) && !staff && !vendor) {
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

  if (sub === 'issue') {
    const ticket = await deps.store.findVendorTicketByOrderName(vendor.id, orderName);
    if (!ticket) return interaction.reply({ content: `No ${orderName} ticket belongs to your vendor account.`, ephemeral: true });
    const details = interaction.options.getString('details', true);
    await deps.store.updateTicket(ticket.key, { status: 'issue', issue: details });
    const issueChannel = findTextChannel(interaction.guild, '🚨・order-issues');
    if (issueChannel) await issueChannel.send(`🚨 **${vendor.displayName}** flagged **${orderName}**\n${details}\nVendor ticket: <#${ticket.channelId}>`);
    await audit(interaction.guild, `🚨 **${vendor.displayName}** flagged order **${orderName}**: ${details}`);
    return interaction.reply({ content: '✅ Aquaphoria staff has been alerted.', ephemeral: true });
  }

  await interaction.deferReply({ ephemeral: true });
  const ticket = await deps.orders.markShipped(interaction.guild, {
    vendorId: vendor.id,
    orderName,
    trackingNumber: interaction.options.getString('tracking', true),
    trackingCompany: interaction.options.getString('carrier') || null,
  });
  await audit(interaction.guild, `🚚 **${vendor.displayName}** shipped **${orderName}** • ${ticket.trackingNumber}${ticket.trackingCompany ? ` • ${ticket.trackingCompany}` : ''}.`);
  await interaction.editReply(`✅ **${orderName}** marked shipped and tracking sent to Shopify/customer. Tracking: **${ticket.trackingNumber}**.`);
}

async function handlePayout(interaction, deps) {
  const sub = interaction.options.getSubcommand();
  if (sub === 'paid') {
    if (!isOwner(interaction, deps.config)) return interaction.reply({ content: 'Only the Aquaphoria owner can mark vendor payouts paid.', ephemeral: true });
    const vendorId = interaction.options.getString('vendor', true);
    const orderName = interaction.options.getString('order', true);
    const ticket = await deps.store.findVendorTicketByOrderName(vendorId, orderName);
    if (!ticket) return interaction.reply({ content: `No ${orderName} ticket belongs to vendor \`${vendorId}\`.`, ephemeral: true });
    const result = await deps.store.markTicketPayoutPaid(ticket.key, {
      vendorId,
      note: `Owner marked ${orderName} paid`,
    });
    const entry = result.entry;
    const payoutChannel = findTextChannel(interaction.guild, '💳・payout-log');
    if (!result.alreadyPaid && payoutChannel) {
      await payoutChannel.send(`💳 Vendor \`${vendorId}\` paid **$${centsToMoney(entry.amountCents)}** for **${orderName}** by <@${interaction.user.id}>.`);
    }
    return interaction.reply({
      content: result.alreadyPaid
        ? `ℹ️ **${orderName}** was already marked paid for vendor \`${vendorId}\`.`
        : `✅ Marked **$${centsToMoney(entry.amountCents)}** paid to vendor \`${vendorId}\` for **${orderName}**.`,
      ephemeral: true,
    });
  }

  const vendor = await requireVendor(interaction, deps.store);
  if (!vendor) return;
  const summary = await deps.store.payoutSummary(vendor.id);
  return interaction.reply({
    content: `💰 **${vendor.displayName} payout status**\nOwed: **$${centsToMoney(summary.owedCents)}**\nPaid: **$${centsToMoney(summary.paidCents)}**\nBalance: **$${centsToMoney(summary.balanceCents)}**`,
    ephemeral: true,
  });
}

async function handleTicket(interaction, deps) {
  const type = interaction.options.getString('type', true);
  const details = interaction.options.getString('details', true);
  const staffRole = await getCanonicalStaffRole(interaction.guild, deps.store);
  if (!staffRole) return interaction.reply({ content: 'Aquaphoria support is not configured yet.', ephemeral: true });

  const supportCategory = interaction.guild.channels.cache.find((channel) => channel.type === ChannelType.GuildCategory && channel.name === '🎫・CUSTOMER SUPPORT');
  if (!supportCategory) return interaction.reply({ content: 'Customer support category is not configured yet.', ephemeral: true });

  await interaction.deferReply({ ephemeral: true });
  const channel = await interaction.guild.channels.create({
    name: `ticket-${type}-${interaction.user.username}`.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 90),
    type: ChannelType.GuildText,
    parent: supportCategory.id,
    permissionOverwrites: [
      { id: interaction.guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
      { id: deps.config.discord.ownerUserId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
      { id: staffRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
      { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
    ],
    reason: `Aquaphoria ${type} support ticket for ${interaction.user.id}`,
  });

  const embed = new EmbedBuilder()
    .setTitle(`🎫 Aquaphoria ${type.toUpperCase()} Support`)
    .setDescription(details)
    .addFields({ name: 'Customer', value: `<@${interaction.user.id}>` })
    .setTimestamp();
  await channel.send({ content: `<@${interaction.user.id}> <@&${staffRole.id}>`, embeds: [embed] });
  await audit(interaction.guild, `🎫 Customer <@${interaction.user.id}> opened ${type} support ticket <#${channel.id}>.`);
  return interaction.editReply(`✅ Your private support ticket is ready: <#${channel.id}>`);
}

export async function registerGuildCommands(guild) {
  return guild.commands.set(commandDefinitions().map((command) => command.toJSON()));
}

export async function handleInteraction(interaction, deps) {
  return createCommandRouter(deps).handle(interaction);
}

export function createCommandRouter(deps) {
  return Object.freeze({
    definitions: commandDefinitions().map((command) => command.toJSON()),

    async handle(interaction) {
      if (!interaction.isChatInputCommand()) return;
      try {
        if (interaction.commandName === 'aquaphoria') return await handleSetup(interaction, deps);
        if (interaction.commandName === 'vendor') return await handleVendor(interaction, deps);
        if (interaction.commandName === 'catalog') return await handleCatalog(interaction, deps);
        if (interaction.commandName === 'product') return await handleProduct(interaction, deps);
        if (interaction.commandName === 'research') return await handleResearch(interaction, deps);
        if (interaction.commandName === 'order') return await handleOrder(interaction, deps);
        if (interaction.commandName === 'payout') return await handlePayout(interaction, deps);
        if (interaction.commandName === 'ticket') return await handleTicket(interaction, deps);
      } catch (error) {
        const message = `❌ ${error?.message ?? 'Something went wrong.'}`.slice(0, 1900);
        if (interaction.deferred || interaction.replied) await interaction.editReply(message).catch(() => undefined);
        else await interaction.reply({ content: message, ephemeral: true }).catch(() => undefined);
        await audit(interaction.guild, `🤖 Command error from <@${interaction.user.id}>: ${error?.stack ?? error}`);
      }
    },
  });
}
