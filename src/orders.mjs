import { ChannelType, EmbedBuilder } from 'discord.js';
import { centsToMoney } from './pricing.mjs';
import { ensureVendorWorkspace, provisionAquaphoriaLayout } from './layout.mjs';

function channelSafe(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/^#/, '')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70) || 'order';
}

function shippingAddress(order) {
  const address = order.shipping_address ?? {};
  const name = [address.first_name, address.last_name].filter(Boolean).join(' ');
  const cityLine = [address.city, address.province_code || address.province, address.zip].filter(Boolean).join(', ');
  return [name, address.address1, address.address2, cityLine, address.country_code || address.country].filter(Boolean).join('\n') || 'No shipping address supplied';
}

function findChannel(guild, name) {
  return guild.channels.cache.find((channel) => channel.type === ChannelType.GuildText && channel.name === name) ?? null;
}

function ticketMarker(key) {
  return `Aquaphoria ticket key: ${key}`;
}

function findTicketChannel(guild, parentId, key) {
  const marker = ticketMarker(key);
  return guild.channels.cache.find((channel) => (
    channel.type === ChannelType.GuildText
    && channel.parentId === parentId
    && String(channel.topic ?? '').includes(marker)
  )) ?? null;
}

async function hasTicketNotice(channel, key) {
  if (String(channel.topic ?? '').includes('state=notified')) return true;
  if (!channel.messages?.fetch) return false;
  const messages = await channel.messages.fetch({ limit: 50 }).catch(() => null);
  if (!messages?.values) return false;
  for (const message of messages.values()) {
    const embeds = message.embeds ?? [];
    if (embeds.some((embed) => String(embed.footer?.text ?? '').includes(ticketMarker(key)))) return true;
  }
  return false;
}

async function audit(guild, text) {
  const channel = findChannel(guild, '🧾・audit-log');
  if (channel) await channel.send(text).catch(() => undefined);
}

async function flagOrderIssue(guild, text) {
  const channel = findChannel(guild, '🚨・order-issues');
  if (channel) await channel.send(text).catch(() => undefined);
}

export function createOrderService({ config, store, shopify }) {
  async function splitOrder(order) {
    const groups = new Map();
    const unresolved = [];

    for (const line of order.line_items ?? []) {
      if (!line.product_id) {
        unresolved.push({ title: line.title, reason: 'line item has no Shopify product id' });
        continue;
      }

      const productId = shopify.gidForNumericProductId(line.product_id);
      let metadata;
      try {
        metadata = await shopify.getVendorMetadata(productId);
      } catch (error) {
        unresolved.push({ title: line.title, productId, reason: error.message });
        continue;
      }

      if (!metadata?.vendorId) {
        unresolved.push({ title: line.title, productId, reason: 'product is not assigned to an Aquaphoria vendor' });
        continue;
      }

      const vendor = await store.getVendor(metadata.vendorId);
      if (!vendor?.active) {
        unresolved.push({ title: line.title, productId, reason: `vendor ${metadata.vendorId} is missing or inactive` });
        continue;
      }

      try {
        await store.setProductOwner(productId, vendor.id);
      } catch (error) {
        unresolved.push({ title: line.title, productId, reason: error.message });
        continue;
      }
      const quantity = Number.isInteger(line.quantity) && line.quantity > 0 ? line.quantity : 1;
      const vendorUnitPayoutCents = metadata.vendorPriceCents + metadata.vendorShippingCents;
      const group = groups.get(vendor.id) ?? {
        vendor,
        items: [],
        productIds: new Set(),
        payoutCents: 0,
      };
      group.items.push({
        productId,
        title: line.title || metadata.title,
        quantity,
        vendorPriceCents: metadata.vendorPriceCents,
        vendorShippingCents: metadata.vendorShippingCents,
        vendorUnitPayoutCents,
      });
      group.productIds.add(productId);
      group.payoutCents += vendorUnitPayoutCents * quantity;
      groups.set(vendor.id, group);
    }

    return {
      groups: [...groups.values()].map((group) => ({ ...group, productIds: [...group.productIds] })),
      unresolved,
    };
  }

  async function createVendorTicket(guild, order, group, roles) {
    const key = `shopify:${order.id}:${group.vendor.id}`;
    const existing = await store.getTicket(key);

    const workspace = await ensureVendorWorkspace(guild, {
      vendor: group.vendor,
      ownerUserId: config.discord.ownerUserId,
      staffRoleId: roles.staffRoleId,
    });

    if (workspace.vendorRoleId !== group.vendor.discordRoleId) {
      group.vendor = await store.upsertVendor({ ...group.vendor, discordRoleId: workspace.vendorRoleId });
    }

    const vendorMember = await guild.members.fetch(group.vendor.discordUserId).catch(() => null);
    if (vendorMember) {
      const globalVendorRole = guild.roles.cache.get(roles.vendorRoleId);
      const privateVendorRole = guild.roles.cache.get(workspace.vendorRoleId);
      if (globalVendorRole) await vendorMember.roles.add(globalVendorRole).catch(() => undefined);
      if (privateVendorRole) await vendorMember.roles.add(privateVendorRole).catch(() => undefined);
    }

    let channel = existing?.channelId ? guild.channels.cache.get(existing.channelId) : null;
    if (!channel) channel = findTicketChannel(guild, workspace.categoryId, key);
    const createdChannel = !channel;
    const baseTopic = `Aquaphoria vendor fulfillment • ${order.name ?? order.id} • ${group.vendor.displayName} • ${ticketMarker(key)}`;
    if (!channel) {
      channel = await guild.channels.create({
        name: `order-${channelSafe(order.name || order.order_number || order.id)}`,
        type: ChannelType.GuildText,
        parent: workspace.categoryId,
        topic: `${baseTopic} • state=created`,
        reason: 'Aquaphoria Shopify paid-order fulfillment ticket',
      });
    }

    const itemText = group.items
      .map((item) => `${item.quantity}× ${item.title} — vendor payout $${centsToMoney(item.vendorUnitPayoutCents)} each`)
      .join('\n');

    const embed = new EmbedBuilder()
      .setTitle(`📦 New Aquaphoria Order ${order.name ?? ''}`.trim())
      .setDescription(`Private fulfillment ticket for **${group.vendor.displayName}**.`)
      .addFields(
        { name: 'Items to ship', value: itemText.slice(0, 1024) || 'No items', inline: false },
        { name: 'Ship to', value: shippingAddress(order).slice(0, 1024), inline: false },
        { name: 'Vendor payout', value: `$${centsToMoney(group.payoutCents)}`, inline: true },
        { name: 'Status', value: 'Awaiting fulfillment', inline: true },
      )
      .setFooter({ text: `${ticketMarker(key)} • Payout includes vendor product price and submitted shipping.` })
      .setTimestamp();

    const saved = await store.recordTicketWithPayout({
      key,
      vendorId: group.vendor.id,
      channelId: channel.id,
      orderId: String(order.id),
      orderGid: shopify.gidForNumericOrderId(order.id),
      orderName: String(order.name ?? order.order_number ?? order.id),
      productIds: group.productIds,
      payoutCents: group.payoutCents,
      status: 'awaiting_fulfillment',
    }, {
      id: `owed:${order.id}:${group.vendor.id}`,
      vendorId: group.vendor.id,
      orderId: String(order.id),
      amountCents: group.payoutCents,
      type: 'owed',
      note: `Vendor fulfillment payout for ${String(order.name ?? order.order_number ?? order.id)}`,
    });
    const ticket = saved.ticket;

    if (!(await hasTicketNotice(channel, key))) {
      await channel.send({
        content: `<@${group.vendor.discordUserId}> New order ready for fulfillment. When shipped, use \`/order shipped\` with the order name and tracking number.`,
        embeds: [embed],
      });
      if (channel.setTopic) await channel.setTopic(`${baseTopic} • state=notified`, 'Mark Aquaphoria ticket notification complete');
    }

    if (createdChannel || !existing) {
      await audit(guild, `📦 Created vendor ticket **${ticket.orderName}** for **${group.vendor.displayName}** • payout $${centsToMoney(group.payoutCents)} • <#${channel.id}>`);
    }
    return ticket;
  }

  return Object.freeze({
    splitOrder,

    async routePaidOrder(guild, order) {
      const layout = await provisionAquaphoriaLayout(guild, { ownerUserId: config.discord.ownerUserId, store });
      const { groups, unresolved } = await splitOrder(order);
      const tickets = [];
      for (const group of groups) tickets.push(await createVendorTicket(guild, order, group, layout.roles));

      if (unresolved.length) {
        const detail = unresolved.map((item) => `• ${item.title ?? item.productId}: ${item.reason}`).join('\n');
        await flagOrderIssue(guild, `⚠️ **${order.name ?? order.id}** has line items that could not be routed to a vendor:\n${detail.slice(0, 1800)}`);
      }
      return { tickets, unresolved };
    },

    async markShipped(guild, { vendorId, orderName, trackingNumber, trackingCompany = null }) {
      const ticket = await store.findVendorTicketByOrderName(vendorId, orderName);
      if (!ticket) throw new Error(`No ${orderName} ticket belongs to this vendor`);
      if (ticket.status === 'shipped') return ticket;

      const fulfillments = await shopify.fulfillVendorItems({
        orderId: ticket.orderGid,
        productIds: ticket.productIds,
        trackingNumber,
        trackingCompany,
      });

      const updated = await store.recordTicket({
        ...ticket,
        status: 'shipped',
        trackingNumber,
        trackingCompany,
        fulfillmentIds: fulfillments.map((fulfillment) => fulfillment?.id).filter(Boolean),
        shippedAt: new Date().toISOString(),
      });

      const channel = guild.channels.cache.get(ticket.channelId);
      if (channel?.isTextBased()) {
        await channel.send(`✅ **Shipped** • Tracking: **${trackingNumber}**${trackingCompany ? ` • ${trackingCompany}` : ''}\nShopify fulfillment was updated and customer notification was requested.`);
      }
      await audit(guild, `✅ Vendor marked **${ticket.orderName}** shipped • tracking ${trackingNumber} • <#${ticket.channelId}>`);
      return updated;
    },

    async reportIssue(guild, { vendorId, orderName, issue }) {
      const ticket = await store.findVendorTicketByOrderName(vendorId, orderName);
      if (!ticket) throw new Error(`No ${orderName} ticket belongs to this vendor`);
      const updated = await store.recordTicket({ ...ticket, status: 'issue', issue: String(issue), issueAt: new Date().toISOString() });
      const channel = guild.channels.cache.get(ticket.channelId);
      if (channel?.isTextBased()) await channel.send(`🚨 **Vendor issue reported:** ${String(issue).slice(0, 1800)}`);
      await flagOrderIssue(guild, `🚨 **${ticket.orderName}** • vendor **${vendorId}** • <#${ticket.channelId}>\n${String(issue).slice(0, 1600)}`);
      return updated;
    },
  });
}
