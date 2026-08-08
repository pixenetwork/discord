import { ChannelType, SlashCommandBuilder } from 'discord.js';
import { ensureVendorWorkspace, provisionAquaphoriaLayout } from './layout.mjs';
import { centsToMoney, moneyToCents } from './pricing.mjs';

const PRODUCT_CATEGORIES = ['live_fish', 'eggs', '3d_printed', 'food', 'bacteria_water_care', 'accessories', 'other'];

function slugify(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

function discordUserId(value) {
  const match = String(value ?? '').match(/\d{15,22}/);
  if (!match) throw new Error('A valid Discord user mention or user ID is required');
  return match[0];
}

function productGid(shopify, value) {
  const text = String(value ?? '').trim();
  if (text.startsWith('gid://shopify/Product/')) return text;
  if (/^\d+$/.test(text)) return shopify.gidForNumericProductId(text);
  throw new Error('Product ID must be a Shopify numeric product id or gid://shopify/Product/...');
}

function findTextChannel(guild, name) {
  return guild.channels.cache.find((channel) => channel.type === ChannelType.GuildText && channel.name === name) ?? null;
}

async function audit(guild, message) {
  const channel = findTextChannel(guild, '🧾・audit-log');
  if (channel) await channel.send(message.slice(0, 1900)).catch(() => undefined);
}

function isStaff(interaction) {
  return interaction.member?.roles?.cache?.some((role) => role.name === 'Aquaphoria Staff') ?? false;
}

function tool(name, description, properties = {}, required = []) {
  return {
    type: 'function',
    name,
    description,
    strict: true,
    parameters: {
      type: 'object',
      properties,
      required,
      additionalProperties: false,
    },
  };
}

const nullableString = { type: ['string', 'null'] };

function ownerTools() {
  return [
    tool('collection_create', 'Create a new Shopify collection for Aquaphoria. New collections stay unpublished until storefront publication is configured.', {
      name: { type: 'string' },
      description: nullableString,
    }, ['name', 'description']),
    tool('collection_list', 'List Shopify collections available for Aquaphoria catalog assignment.'),
    tool('collection_rename', 'Rename a Shopify collection.', {
      collection: { type: 'string' },
      new_name: { type: 'string' },
    }, ['collection', 'new_name']),
    tool('collection_assign_vendor', 'Assign an approved vendor to a Shopify collection and add an automatic vendor source so that vendor products populate it.', {
      vendor_id: { type: 'string' },
      collection: { type: 'string' },
    }, ['vendor_id', 'collection']),
    tool('vendor_add', 'Approve a Discord member as an Aquaphoria vendor and optionally assign a Shopify catalog collection.', {
      discord_user_id: { type: 'string' },
      display_name: { type: 'string' },
      vendor_id: nullableString,
      collection: nullableString,
    }, ['discord_user_id', 'display_name', 'vendor_id', 'collection']),
    tool('vendor_list', 'List configured Aquaphoria vendors and their assigned Shopify collections.'),
    tool('research', 'Queue or run evidence-backed Aquapedia research for a medaka/shrimp strain or breeder.', {
      entity_type: { type: 'string', enum: ['strain', 'breeder'] },
      name: { type: 'string' },
    }, ['entity_type', 'name']),
    tool('catalog_add', 'Add a vendor-owned Shopify product. The vendor price and shipping are combined and the configured Aquaphoria markup is added to produce retail.', {
      vendor_id: { type: 'string' },
      name: { type: 'string' },
      category: { type: 'string', enum: PRODUCT_CATEGORIES },
      price: { type: 'string' },
      shipping: { type: 'string' },
      stock: { type: 'integer', minimum: 0 },
      description: nullableString,
      use_attachment: { type: 'boolean' },
    }, ['vendor_id', 'name', 'category', 'price', 'shipping', 'stock', 'description', 'use_attachment']),
    tool('catalog_list', 'List products owned by a vendor.', {
      vendor_id: { type: 'string' },
    }, ['vendor_id']),
    tool('catalog_stock', 'Update stock on a vendor-owned product.', {
      vendor_id: { type: 'string' },
      product_id: { type: 'string' },
      quantity: { type: 'integer', minimum: 0 },
    }, ['vendor_id', 'product_id', 'quantity']),
    tool('catalog_price', 'Update vendor price and vendor shipping on a vendor-owned product; retail markup recalculates automatically.', {
      vendor_id: { type: 'string' },
      product_id: { type: 'string' },
      price: { type: 'string' },
      shipping: { type: 'string' },
    }, ['vendor_id', 'product_id', 'price', 'shipping']),
    tool('catalog_status', 'Show, hide, or archive a vendor-owned product.', {
      vendor_id: { type: 'string' },
      product_id: { type: 'string' },
      status: { type: 'string', enum: ['active', 'hidden', 'archived'] },
    }, ['vendor_id', 'product_id', 'status']),
    tool('payout_status', 'Read a vendor payout balance. This never transfers money.', {
      vendor_id: { type: 'string' },
    }, ['vendor_id']),
  ];
}

function staffTools() {
  return [
    tool('collection_list', 'List Shopify collections available for Aquaphoria.'),
    tool('vendor_list', 'List configured Aquaphoria vendors and their assigned collections.'),
    tool('research', 'Queue or run evidence-backed Aquapedia research for a strain or breeder.', {
      entity_type: { type: 'string', enum: ['strain', 'breeder'] },
      name: { type: 'string' },
    }, ['entity_type', 'name']),
  ];
}

function vendorTools() {
  return [
    tool('research', 'Queue or run evidence-backed Aquapedia research for a strain or breeder.', {
      entity_type: { type: 'string', enum: ['strain', 'breeder'] },
      name: { type: 'string' },
    }, ['entity_type', 'name']),
    tool('catalog_add', 'Add a product to your own Aquaphoria catalog.', {
      name: { type: 'string' },
      category: { type: 'string', enum: PRODUCT_CATEGORIES },
      price: { type: 'string' },
      shipping: { type: 'string' },
      stock: { type: 'integer', minimum: 0 },
      description: nullableString,
      use_attachment: { type: 'boolean' },
    }, ['name', 'category', 'price', 'shipping', 'stock', 'description', 'use_attachment']),
    tool('catalog_list', 'List products in your own Aquaphoria catalog.'),
    tool('catalog_stock', 'Update stock on one of your own products.', {
      product_id: { type: 'string' },
      quantity: { type: 'integer', minimum: 0 },
    }, ['product_id', 'quantity']),
    tool('catalog_price', 'Update your product price and shipping; Aquaphoria retail markup recalculates.', {
      product_id: { type: 'string' },
      price: { type: 'string' },
      shipping: { type: 'string' },
    }, ['product_id', 'price', 'shipping']),
    tool('catalog_status', 'Show, hide, or archive one of your own products.', {
      product_id: { type: 'string' },
      status: { type: 'string', enum: ['active', 'hidden', 'archived'] },
    }, ['product_id', 'status']),
    tool('payout_status', 'Read your own Aquaphoria payout balance. This never transfers money.'),
  ];
}

function responseText(response) {
  const parts = [];
  for (const item of response.output ?? []) {
    if (item.type !== 'message') continue;
    for (const content of item.content ?? []) {
      if (content.type === 'output_text' && content.text) parts.push(content.text);
      if (content.type === 'refusal' && content.refusal) parts.push(content.refusal);
    }
  }
  return parts.join('\n').trim();
}

async function openaiResponse(config, body) {
  if (!config.openai.apiKey) throw new Error('OPENAI_API_KEY is not configured for /gpt');
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.openai.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`OpenAI API error ${response.status}: ${payload.error?.message ?? 'unknown error'}`);
  return payload;
}

async function ensureVendorFromTool(interaction, deps, args) {
  const userId = discordUserId(args.discord_user_id);
  const member = await interaction.guild.members.fetch(userId).catch(() => null);
  if (!member) throw new Error(`Discord member ${userId} is not in the Aquaphoria server`);
  const displayName = String(args.display_name).trim();
  const id = slugify(args.vendor_id || displayName);
  if (!id) throw new Error('Vendor ID could not be generated');

  const layout = await provisionAquaphoriaLayout(interaction.guild, { ownerUserId: deps.config.discord.ownerUserId });
  let vendor = await deps.store.upsertVendor({ id, discordUserId: userId, displayName, catalogSlug: id, active: true });
  const workspace = await ensureVendorWorkspace(interaction.guild, {
    vendor,
    ownerUserId: deps.config.discord.ownerUserId,
    staffRoleId: layout.roles.staffRoleId,
  });
  vendor = await deps.store.upsertVendor({ ...vendor, discordRoleId: workspace.vendorRoleId });
  await member.roles.add(layout.roles.vendorRoleId);
  await member.roles.add(workspace.vendorRoleId);

  if (args.collection) vendor = await deps.collections.assignVendor(vendor.id, args.collection);
  await audit(interaction.guild, `🤖 /gpt approved vendor **${vendor.displayName}** (\`${vendor.id}\`) for <@${userId}>${vendor.catalogCollectionTitle ? ` → **${vendor.catalogCollectionTitle}**` : ''}.`);
  return vendor;
}

function statusToShopify(status) {
  if (status === 'active') return 'ACTIVE';
  if (status === 'hidden') return 'DRAFT';
  return 'ARCHIVED';
}

async function executeTool(interaction, deps, actor, name, args, attachmentUrl) {
  const requireOwner = () => {
    if (!actor.owner) throw new Error(`${name} is owner-only`);
  };
  const vendorFor = async (requested) => {
    if (actor.owner) {
      const vendor = await deps.store.getVendor(requested);
      if (!vendor || vendor.active === false) throw new Error(`Active vendor "${requested}" was not found`);
      return vendor;
    }
    if (!actor.vendor) throw new Error('This action requires an approved vendor account');
    return actor.vendor;
  };

  if (name === 'collection_create') {
    requireOwner();
    const collection = await deps.collections.create({ name: args.name, description: args.description ?? '' });
    await audit(interaction.guild, `🤖 /gpt created Shopify collection **${collection.title}** (\`${collection.id}\`).`);
    return { ok: true, collection };
  }
  if (name === 'collection_list') {
    if (!actor.owner && !actor.staff) throw new Error('Collection listing is limited to Aquaphoria management');
    return { ok: true, collections: await deps.collections.list() };
  }
  if (name === 'collection_rename') {
    requireOwner();
    const collection = await deps.collections.rename(args.collection, args.new_name);
    await audit(interaction.guild, `🤖 /gpt renamed collection to **${collection.title}** (\`${collection.id}\`).`);
    return { ok: true, collection };
  }
  if (name === 'collection_assign_vendor') {
    requireOwner();
    const vendor = await deps.collections.assignVendor(args.vendor_id, args.collection);
    await audit(interaction.guild, `🤖 /gpt assigned **${vendor.displayName}** to collection **${vendor.catalogCollectionTitle}**.`);
    return { ok: true, vendor };
  }
  if (name === 'vendor_add') {
    requireOwner();
    return { ok: true, vendor: await ensureVendorFromTool(interaction, deps, args) };
  }
  if (name === 'vendor_list') {
    if (!actor.owner && !actor.staff) throw new Error('Vendor listing is limited to Aquaphoria management');
    return { ok: true, vendors: await deps.store.listVendors() };
  }
  if (name === 'research') {
    if (!actor.owner && !actor.staff && !actor.vendor) throw new Error('Research is limited to Aquaphoria management and approved vendors');
    return { ok: true, result: await deps.research.research({ entityType: args.entity_type, name: args.name, requestedBy: interaction.user.id }) };
  }
  if (name === 'catalog_add') {
    const vendor = await vendorFor(args.vendor_id);
    const result = await deps.catalog.add(vendor, {
      name: args.name,
      category: args.category,
      vendorPriceCents: moneyToCents(args.price),
      vendorShippingCents: moneyToCents(args.shipping),
      stock: args.stock,
      description: args.description ?? '',
      imageUrl: args.use_attachment ? attachmentUrl : null,
      visible: true,
    });
    await audit(interaction.guild, `🤖 /gpt synced **${result.product.title}** for **${vendor.displayName}** at retail **$${centsToMoney(result.pricing.retailTotalCents)}**.`);
    return { ok: true, product: result.product, pricing: result.pricing };
  }
  if (name === 'catalog_list') {
    const vendor = await vendorFor(args.vendor_id);
    return { ok: true, vendor: vendor.displayName, products: await deps.catalog.list(vendor) };
  }
  if (name === 'catalog_stock') {
    const vendor = await vendorFor(args.vendor_id);
    const id = productGid(deps.shopify, args.product_id);
    const product = await deps.catalog.setStock(vendor, id, args.quantity);
    await audit(interaction.guild, `🤖 /gpt changed stock for \`${id}\` (${vendor.displayName}) to **${args.quantity}**.`);
    return { ok: true, product };
  }
  if (name === 'catalog_price') {
    const vendor = await vendorFor(args.vendor_id);
    const id = productGid(deps.shopify, args.product_id);
    const pricing = await deps.catalog.updatePricing(vendor, id, {
      vendorPriceCents: moneyToCents(args.price),
      vendorShippingCents: moneyToCents(args.shipping),
    });
    await audit(interaction.guild, `🤖 /gpt repriced \`${id}\` (${vendor.displayName}) to retail **$${centsToMoney(pricing.retailTotalCents)}**.`);
    return { ok: true, pricing };
  }
  if (name === 'catalog_status') {
    const vendor = await vendorFor(args.vendor_id);
    const id = productGid(deps.shopify, args.product_id);
    const product = await deps.catalog.setStatus(vendor, id, statusToShopify(args.status));
    await audit(interaction.guild, `🤖 /gpt changed **${product.title}** (${vendor.displayName}) to **${args.status}**.`);
    return { ok: true, product };
  }
  if (name === 'payout_status') {
    const vendor = await vendorFor(args.vendor_id);
    return { ok: true, vendor: vendor.displayName, summary: await deps.store.payoutSummary(vendor.id) };
  }
  throw new Error(`Unknown GPT tool: ${name}`);
}

async function runGpt(interaction, deps) {
  const owner = interaction.user.id === deps.config.discord.ownerUserId;
  const staff = isStaff(interaction);
  const vendor = await deps.store.getVendorByDiscordUser(interaction.user.id);
  if (!owner && !staff && !vendor) {
    throw new Error('/gpt is currently limited to the Aquaphoria owner, staff, and approved vendors');
  }

  const actor = { owner, staff, vendor };
  const tools = owner ? ownerTools() : staff ? staffTools() : vendorTools();
  const prompt = interaction.options.getString('prompt', true);
  const attachment = interaction.options.getAttachment('attachment');
  const attachmentUrl = attachment?.url ?? null;
  const content = [{ type: 'input_text', text: prompt }];
  if (attachmentUrl && attachment?.contentType?.startsWith('image/')) {
    content.push({ type: 'input_image', image_url: attachmentUrl, detail: 'auto' });
  }

  const roleText = owner
    ? 'Aquaphoria owner. May use all listed tools.'
    : staff
      ? 'Aquaphoria staff. Read/Research tools only.'
      : `Approved vendor ${vendor.displayName} (${vendor.id}). May only change this vendor's own catalog.`;

  const instructions = [
    'You are Aquaphoria GPT inside Discord. Interpret the user request naturally and use the available function tools when an action or lookup is requested.',
    'Never claim an action happened unless a function tool returned success.',
    'Never bypass catalog ownership, Discord role, Shopify, payout, or research permissions. The server is authoritative.',
    'Vendor product price and vendor shipping are separate internal values; Aquaphoria retail markup is calculated by server code.',
    'Aquapedia and breeder operations are private. Do not expose internal payout, customer, research-queue, or other-vendor data to unauthorized users.',
    'If a request is ambiguous in a way that could mutate the wrong collection/product/vendor, ask one concise question instead of guessing.',
    `Current actor: ${roleText}`,
    attachmentUrl ? `One Discord attachment is available at ${attachmentUrl}. Use it for catalog_add only when the user clearly intends the attachment to be the product image.` : 'No attachment was supplied.',
  ].join('\n');

  let history = [{ role: 'user', content }];
  for (let round = 0; round < 6; round += 1) {
    const response = await openaiResponse(deps.config, {
      model: deps.config.openai.model,
      instructions,
      input: history,
      tools,
      tool_choice: 'auto',
      parallel_tool_calls: false,
      max_output_tokens: 1200,
      store: false,
      safety_identifier: `discord:${interaction.user.id}`,
    });

    const calls = (response.output ?? []).filter((item) => item.type === 'function_call');
    if (!calls.length) return responseText(response) || 'Done.';

    const outputs = [];
    for (const call of calls) {
      let args;
      try {
        args = JSON.parse(call.arguments || '{}');
      } catch {
        args = {};
      }
      try {
        const result = await executeTool(interaction, deps, actor, call.name, args, attachmentUrl);
        outputs.push({ type: 'function_call_output', call_id: call.call_id, output: JSON.stringify(result) });
      } catch (error) {
        outputs.push({ type: 'function_call_output', call_id: call.call_id, output: JSON.stringify({ ok: false, error: error.message }) });
      }
    }
    history = [...history, ...(response.output ?? []), ...outputs];
  }
  throw new Error('GPT reached the maximum tool-call rounds for this request');
}

function commandDefinitions() {
  const gpt = new SlashCommandBuilder()
    .setName('gpt')
    .setDescription('Ask Aquaphoria GPT to manage or explain authorized Aquaphoria tasks')
    .addStringOption((option) => option.setName('prompt').setDescription('Tell GPT what you want done').setRequired(true).setMaxLength(1800))
    .addAttachmentOption((option) => option.setName('attachment').setDescription('Optional product/fish image for the request').setRequired(false));

  const collection = new SlashCommandBuilder()
    .setName('collection')
    .setDescription('Owner tools for Aquaphoria Shopify collections')
    .addSubcommand((sub) => sub
      .setName('create')
      .setDescription('Create a Shopify collection')
      .addStringOption((option) => option.setName('name').setDescription('Collection name').setRequired(true).setMaxLength(120))
      .addStringOption((option) => option.setName('description').setDescription('Optional collection description').setRequired(false).setMaxLength(1000)))
    .addSubcommand((sub) => sub.setName('list').setDescription('List Shopify collections'))
    .addSubcommand((sub) => sub
      .setName('assign')
      .setDescription('Assign an approved vendor to a Shopify collection')
      .addStringOption((option) => option.setName('vendor').setDescription('Vendor ID, e.g. toa').setRequired(true))
      .addStringOption((option) => option.setName('collection').setDescription('Collection title, handle, numeric ID, or gid').setRequired(true)))
    .addSubcommand((sub) => sub
      .setName('rename')
      .setDescription('Rename a Shopify collection')
      .addStringOption((option) => option.setName('collection').setDescription('Collection title, handle, numeric ID, or gid').setRequired(true))
      .addStringOption((option) => option.setName('name').setDescription('New collection name').setRequired(true).setMaxLength(120)));

  return [gpt.toJSON(), collection.toJSON()];
}

export function createGptController(deps) {
  return Object.freeze({
    definitions: commandDefinitions(),

    async register(guild) {
      const existing = await guild.commands.fetch();
      for (const definition of commandDefinitions()) {
        const current = existing.find((command) => command.name === definition.name);
        if (current) await current.edit(definition);
        else await guild.commands.create(definition);
      }
    },

    async handle(interaction) {
      if (!interaction.isChatInputCommand()) return false;
      if (!['gpt', 'collection'].includes(interaction.commandName)) return false;
      try {
        if (interaction.commandName === 'gpt') {
          await interaction.deferReply({ ephemeral: true });
          const text = await runGpt(interaction, deps);
          await interaction.editReply(text.slice(0, 1950));
          await audit(interaction.guild, `🤖 /gpt by <@${interaction.user.id}>: ${interaction.options.getString('prompt', true)}`);
          return true;
        }

        if (interaction.user.id !== deps.config.discord.ownerUserId) {
          await interaction.reply({ content: 'Only the Aquaphoria owner can manage Shopify collections.', ephemeral: true });
          return true;
        }
        const sub = interaction.options.getSubcommand();
        if (sub === 'create') {
          await interaction.deferReply({ ephemeral: true });
          const collection = await deps.collections.create({
            name: interaction.options.getString('name', true),
            description: interaction.options.getString('description') || '',
          });
          await audit(interaction.guild, `🛍️ Created collection **${collection.title}** (\`${collection.id}\`) by <@${interaction.user.id}>.`);
          await interaction.editReply(`✅ Created **${collection.title}**. Shopify collection ID: \`${collection.id}\``);
          return true;
        }
        if (sub === 'list') {
          const collections = await deps.collections.list();
          const text = collections.length
            ? collections.slice(0, 30).map((item) => `• **${item.title}** — \`${item.handle}\` — \`${item.id}\``).join('\n')
            : 'No Shopify collections found.';
          await interaction.reply({ content: text.slice(0, 1950), ephemeral: true });
          return true;
        }
        if (sub === 'assign') {
          await interaction.deferReply({ ephemeral: true });
          const vendor = await deps.collections.assignVendor(
            interaction.options.getString('vendor', true),
            interaction.options.getString('collection', true),
          );
          await audit(interaction.guild, `🐟 Assigned **${vendor.displayName}** to **${vendor.catalogCollectionTitle}** by <@${interaction.user.id}>.`);
          await interaction.editReply(`✅ **${vendor.displayName}** now controls catalog **${vendor.catalogCollectionTitle}**.`);
          return true;
        }
        if (sub === 'rename') {
          await interaction.deferReply({ ephemeral: true });
          const collection = await deps.collections.rename(
            interaction.options.getString('collection', true),
            interaction.options.getString('name', true),
          );
          await audit(interaction.guild, `✏️ Renamed Shopify collection to **${collection.title}** by <@${interaction.user.id}>.`);
          await interaction.editReply(`✅ Collection renamed to **${collection.title}**.`);
          return true;
        }
      } catch (error) {
        const message = `❌ ${error?.message ?? 'GPT/collection command failed.'}`.slice(0, 1900);
        if (interaction.deferred || interaction.replied) await interaction.editReply(message).catch(() => undefined);
        else await interaction.reply({ content: message, ephemeral: true }).catch(() => undefined);
        await audit(interaction.guild, `🤖 GPT/collection error from <@${interaction.user.id}>: ${error?.stack ?? error}`);
        return true;
      }
      return true;
    },
  });
}
