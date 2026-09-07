import test from 'node:test';
import assert from 'node:assert/strict';
import { ChannelType } from 'discord.js';
import { createCommandRouter } from '../src/commands.mjs';

test('verified partner starts a private guided product submission ticket', async () => {
  const created = [];
  const sent = [];
  let saved = null;
  let saveOptions = null;
  let reply = null;
  const support = { id: 'support-cat', type: ChannelType.GuildCategory, name: '🎫・CUSTOMER SUPPORT' };
  const guild = {
    roles: { everyone: { id: 'everyone' }, cache: new Map([['staff-role', { id: 'staff-role' }]]) },
    channels: {
      cache: [support],
      async create(options) {
        created.push(options);
        return { id: 'product-ticket-1', async send(message) { sent.push(message); } };
      },
    },
  };
  const store = {
    async getVendorByDiscordUser() { return { id: 'toa', displayName: 'TOA', catalogSlug: 'toa' }; },
    async getLayoutRoles() { return { staffRoleId: 'staff-role' }; },
    async saveProductSubmission(value, options) { saved = value; saveOptions = options; return value; },
  };
  const interaction = {
    id: '123456789012345678', user: { id: '100', username: 'breeder' }, guild,
    commandName: 'product', isChatInputCommand: () => true,
    options: { getSubcommand: () => 'submit', getString: (name) => name === 'type' ? 'livestock' : null },
    async deferReply() {}, async editReply(value) { reply = value; },
  };
  const router = createCommandRouter({
    config: { discord: { ownerUserId: 'owner' }, marketplace: { defaultMarkupPercent: 5 } },
    store,
  });

  await router.handle(interaction);

  assert.equal(created.length, 1);
  assert.equal(created[0].parent, 'support-cat');
  assert.equal(saved.vendorId, 'toa');
  assert.equal(saved.type, 'livestock');
  assert.equal(saved.status, 'draft');
  assert.equal(saved.ticketChannelId, 'product-ticket-1');
  assert.match(String(sent[0]?.content ?? ''), /Product\/strain name:/);
  assert.match(String(sent[0]?.content ?? ''), /\/product fill/);
  assert.match(String(reply ?? ''), /product-ticket-1/);
});

test('verified partner fills a draft and receives a pending-review preview', async () => {
  let saved = null;
  let saveOptions = null;
  let reply = null;
  const ticketMessages = [];
  const ticket = { id: 'product-ticket-1', async send(message) { ticketMessages.push(message); } };
  const guild = {
    channels: { cache: [ticket] },
  };
  const store = {
    async getVendorByDiscordUser() { return { id: 'toa', displayName: 'TOA', catalogSlug: 'toa' }; },
    async getProductSubmission() { return { id: 'product:123', vendorId: 'toa', submitterDiscordId: '100', type: 'livestock', status: 'draft', fields: {}, media: [], ticketChannelId: 'product-ticket-1' }; },
    async saveProductSubmission(value, options) { saved = value; saveOptions = options; return value; },
  };
  const details = [
    'Product/strain name: Blue Dream Neocaridina', 'Quantity available: 10',
    'Vendor price: 12.00', 'Vendor shipping: 15.00', 'Shipping origin: Houston, TX',
    'DOA policy: 2-hour photo/video claim', 'Description / traits: Deep blue line',
    'Needs Aquapedia research? yes/no: yes',
  ].join('\n');
  const interaction = {
    id: 'fill-1', user: { id: '100', username: 'breeder' }, guild,
    commandName: 'product', isChatInputCommand: () => true, deferred: false, replied: false,
    options: {
      getSubcommand: () => 'fill',
      getString: (name) => name === 'submission' ? 'product:123' : name === 'details' ? details : null,
      getAttachment: (name) => name === 'media' ? { url: 'https://example.com/shrimp.jpg', name: 'shrimp.jpg', contentType: 'image/jpeg' } : null,
    },
    async deferReply() { this.deferred = true; },
    async editReply(value) { reply = value; },
    async reply(value) { this.replied = true; reply = value?.content ?? value; },
  };
  const router = createCommandRouter({ config: { discord: { ownerUserId: 'owner' }, marketplace: { defaultMarkupPercent: 5 } }, store });
  await router.handle(interaction);

  assert.equal(saved.status, 'pending');
  assert.deepEqual(saveOptions?.expectedStatuses, ['draft']);
  assert.equal(saved.media.length, 1);
  assert.equal(saved.fields['product/strain name'], 'Blue Dream Neocaridina');
  assert.match(String(ticketMessages[0] ?? ''), /Product Preview/);
  assert.match(String(ticketMessages[0] ?? ''), /28\.35/);
  assert.match(String(reply ?? ''), /pending review/i);
});

test('staff approval syncs a pending partner draft to Shopify exactly once', async () => {
  let catalogCalls = 0;
  let reply = null;
  const ticketMessages = [];
  const vendorMessages = [];
  let submission = {
    id: 'product:123', vendorId: 'toa', submitterDiscordId: '100', type: 'livestock', status: 'pending',
    ticketChannelId: 'product-ticket-1', media: [{ url: 'https://example.com/shrimp.jpg' }], missing: [],
    fields: {
      'product/strain name': 'Blue Dream Neocaridina', 'quantity available': '10',
      'vendor price': '12.00', 'vendor shipping': '15.00', 'shipping origin': 'Houston, TX',
      'doa policy': '2-hour photo/video claim', 'description / traits': 'Deep blue line',
      'needs aquapedia research? yes/no': 'yes',
    },
  };
  const store = {
    async getLayoutRoles() { return { staffRoleId: 'staff-role' }; },
    async getProductSubmission() { return submission; },
    async getVendor() { return { id: 'toa', displayName: 'TOA', catalogSlug: 'toa', active: true }; },
    async saveProductSubmission(value) { submission = value; return value; },
    async claimProductApproval() { submission = { ...submission, status: 'approval_processing', approvalAttempt: 1 }; return { claimed: true, record: submission }; },
    async markProductApprovalPublishing() { submission = { ...submission, approvalPhase: 'publishing' }; return submission; },
    async completeProductApproval(id, patch) { submission = { ...submission, ...patch, status: 'approved' }; return submission; },
    async failProductApproval(id, error) { submission = { ...submission, status: 'pending', approvalLastError: String(error?.message ?? error) }; return submission; },
  };
  const catalog = {
    async add(vendor, product) {
      catalogCalls += 1;
      assert.equal(vendor.id, 'toa');
      assert.equal(product.vendorPriceCents, 1200);
      assert.equal(product.vendorShippingCents, 1500);
      return { product: { id: 'gid://shopify/Product/1', title: product.name, handle: 'toa-blue-dream' }, pricing: { vendorPriceCents: 1200, vendorShippingCents: 1500, markupPercent: 5, retailTotalCents: 2835 } };
    },
  };
  const ticket = { id: 'product-ticket-1', async send(message) { ticketMessages.push(message); } };
  const vendorCategory = { id: 'vendor-hq', type: ChannelType.GuildCategory, name: '🐟・TOA HQ' };
  const vendorCatalog = { id: 'vendor-catalog', type: ChannelType.GuildText, name: '🛍️・catalog', parentId: 'vendor-hq', async send(message) { vendorMessages.push(message); } };
  const guild = { channels: { cache: [ticket, vendorCategory, vendorCatalog] } };
  const interaction = {
    id: 'review-1', user: { id: 'staff-user' }, member: { roles: { cache: new Set(['staff-role']) } }, guild,
    commandName: 'product', isChatInputCommand: () => true, deferred: false, replied: false,
    options: {
      getSubcommand: () => 'review',
      getString: (name) => name === 'submission' ? 'product:123' : name === 'action' ? 'approve' : null,
    },
    async deferReply() { this.deferred = true; }, async editReply(value) { reply = value; },
    async reply(value) { this.replied = true; reply = value?.content ?? value; },
  };
  const deps = { config: { discord: { ownerUserId: 'owner' }, marketplace: { defaultMarkupPercent: 5 } }, store, catalog };
  const router = createCommandRouter(deps);

  await router.handle(interaction);
  await router.handle(interaction);

  assert.equal(catalogCalls, 1);
  assert.equal(submission.status, 'approved');
  assert.equal(submission.shopifyProductId, 'gid://shopify/Product/1');
  assert.match(String(ticketMessages[0] ?? ''), /APPROVED/);
  assert.match(String(vendorMessages[0] ?? ''), /APPROVED|synced/i);
  assert.match(String(reply ?? ''), /already approved|approved/i);
});

test('staff can request changes or reject without calling Shopify', async () => {
  let submission = { id: 'product:456', vendorId: 'toa', type: 'livestock', status: 'pending', ticketChannelId: 'ticket-456', fields: {}, media: [] };
  let catalogCalls = 0;
  let reviewSaveOptions = null;
  const messages = [];
  const store = {
    async getLayoutRoles() { return { staffRoleId: 'staff-role' }; },
    async getProductSubmission() { return submission; },
    async saveProductSubmission(value, options) { submission = value; reviewSaveOptions = options; return value; },
  };
  const deps = {
    config: { discord: { ownerUserId: 'owner' }, marketplace: { defaultMarkupPercent: 5 } },
    store,
    catalog: { async add() { catalogCalls += 1; throw new Error('should not sync'); } },
  };
  const guild = { channels: { cache: [{ id: 'ticket-456', async send(message) { messages.push(message); } }] } };
  let action = 'request_changes';
  const interaction = {
    user: { id: 'staff-user' }, member: { roles: { cache: new Set(['staff-role']) } }, guild,
    commandName: 'product', isChatInputCommand: () => true, deferred: false, replied: false,
    options: {
      getSubcommand: () => 'review',
      getString: (name) => name === 'submission' ? 'product:456' : name === 'action' ? action : name === 'notes' ? 'Please add a clearer photo.' : null,
    },
    async deferReply() { this.deferred = true; }, async editReply() {}, async reply() { this.replied = true; },
  };
  const router = createCommandRouter(deps);

  await router.handle(interaction);
  assert.equal(submission.status, 'changes_requested');
  assert.deepEqual(reviewSaveOptions?.expectedStatuses, ['pending']);
  assert.match(String(messages.at(-1) ?? ''), /CHANGES REQUESTED/);

  submission = { ...submission, status: 'pending' };
  action = 'reject';
  await router.handle(interaction);
  assert.equal(submission.status, 'rejected');
  assert.match(String(messages.at(-1) ?? ''), /REJECTED/);
  assert.equal(catalogCalls, 0);
});


test('unverified member cannot start a partner product submission', async () => {
  let created = 0;
  let reply = null;
  const store = { async getVendorByDiscordUser() { return null; } };
  const interaction = {
    user: { id: 'not-vendor' }, guild: { channels: { cache: [], async create() { created += 1; } } },
    commandName: 'product', isChatInputCommand: () => true,
    options: { getSubcommand: () => 'submit', getString: () => 'livestock' },
    async reply(value) { reply = value?.content ?? value; },
  };
  await createCommandRouter({ config: { discord: { ownerUserId: 'owner' } }, store }).handle(interaction);
  assert.equal(created, 0);
  assert.match(String(reply ?? ''), /approved Aquaphoria vendor/i);
});

test('partner cannot fill a submission owned by another vendor', async () => {
  let saved = false;
  let reply = null;
  const store = {
    async getVendorByDiscordUser() { return { id: 'mimu', displayName: 'MIMU' }; },
    async getProductSubmission() { return { id: 'product:toa', vendorId: 'toa', type: 'livestock', status: 'draft', media: [] }; },
    async saveProductSubmission() { saved = true; },
  };
  const interaction = {
    user: { id: '200' }, guild: { channels: { cache: [] } }, commandName: 'product', isChatInputCommand: () => true,
    options: { getSubcommand: () => 'fill', getString: (name) => name === 'submission' ? 'product:toa' : 'details', getAttachment: () => null },
    async reply(value) { reply = value?.content ?? value; }, async editReply(value) { reply = value; },
  };
  await createCommandRouter({ config: { discord: { ownerUserId: 'owner' }, marketplace: { defaultMarkupPercent: 5 } }, store }).handle(interaction);
  assert.equal(saved, false);
  assert.match(String(reply ?? ''), /belongs to another vendor/i);
});

test('incremental product fill preserves fields already saved on the draft', async () => {
  let submission = { id: 'product:inc', vendorId: 'toa', submitterDiscordId: '100', type: 'livestock', status: 'draft', ticketChannelId: 'ticket-inc', media: [], fields: { 'product/strain name': 'Blue Dream', 'vendor price': '12.00' } };
  const store = {
    async getVendorByDiscordUser() { return { id: 'toa', displayName: 'TOA', catalogSlug: 'toa' }; },
    async getProductSubmission() { return submission; },
    async saveProductSubmission(value) { submission = value; return value; },
  };
  const interaction = {
    user: { id: '100' }, guild: { channels: { cache: [{ id: 'ticket-inc', async send() {} }] } },
    commandName: 'product', isChatInputCommand: () => true, deferred: false, replied: false,
    options: {
      getSubcommand: () => 'fill',
      getString: (name) => name === 'submission' ? 'product:inc' : name === 'details' ? 'Quantity available: 10\nVendor shipping: 15.00' : null,
      getAttachment: () => null,
    },
    async deferReply() { this.deferred = true; }, async editReply() {}, async reply() { this.replied = true; },
  };
  const router = createCommandRouter({ config: { marketplace: { defaultMarkupPercent: 5 } }, store });
  await router.handle(interaction);
  assert.equal(submission.fields['product/strain name'], 'Blue Dream');
  assert.equal(submission.fields['vendor price'], '12.00');
  assert.equal(submission.fields['quantity available'], '10');
  assert.equal(submission.fields['vendor shipping'], '15.00');
});

test('staff cannot request changes or reject an already approved submission', async () => {
  let savedCalls = 0;
  const submission = { id: 'product:done', vendorId: 'toa', submitterDiscordId: '100', type: 'livestock', status: 'approved', shopifyProductId: 'gid://shopify/Product/1', fields: {}, media: [] };
  const store = {
    async getLayoutRoles() { return { staffRoleId: 'staff-role' }; },
    async getProductSubmission() { return submission; },
    async saveProductSubmission() { savedCalls += 1; throw new Error('should not mutate approved'); },
  };
  let reply = null;
  const interaction = {
    user: { id: 'staff' }, member: { roles: { cache: new Set(['staff-role']) } }, guild: { channels: { cache: [] } },
    commandName: 'product', isChatInputCommand: () => true, deferred: false, replied: false,
    options: { getSubcommand: () => 'review', getString: (name) => name === 'submission' ? 'product:done' : name === 'action' ? 'reject' : null },
    async deferReply() { this.deferred = true; }, async editReply(value) { reply = value?.content ?? value; }, async reply(value) { this.replied = true; reply = value?.content ?? value; },
  };
  const router = createCommandRouter({ config: { discord: { ownerUserId: 'owner' } }, store });
  await router.handle(interaction);
  assert.equal(savedCalls, 0);
  assert.match(String(reply), /pending|already approved/i);
});

test('concurrent staff approval is blocked by the durable approval lease', async () => {
  let catalogCalls = 0;
  let reply = null;
  const submission = { id: 'product:race', vendorId: 'toa', submitterDiscordId: '100', type: 'livestock', status: 'pending', fields: {} };
  const store = {
    async getLayoutRoles() { return { staffRoleId: 'staff-role' }; },
    async getProductSubmission() { return submission; },
    async claimProductApproval() { return { claimed: false, reason: 'processing', existing: { ...submission, status: 'approval_processing' } }; },
  };
  const interaction = {
    user: { id: 'staff-user' }, member: { roles: { cache: new Set(['staff-role']) } }, guild: { channels: { cache: [] } },
    commandName: 'product', isChatInputCommand: () => true, deferred: false, replied: false,
    options: { getSubcommand: () => 'review', getString: (name) => name === 'submission' ? 'product:race' : name === 'action' ? 'approve' : null },
    async reply(value) { this.replied = true; reply = value?.content ?? value; }, async deferReply() { this.deferred = true; }, async editReply(value) { reply = value; },
  };
  const router = createCommandRouter({ config: { discord: { ownerUserId: 'owner' }, marketplace: { defaultMarkupPercent: 5 } }, store, catalog: { async add() { catalogCalls += 1; } } });
  await router.handle(interaction);
  assert.equal(catalogCalls, 0);
  assert.match(String(reply ?? ''), /already being approved|in progress/i);
});

test('Shopify approval failure releases the durable approval claim', async () => {
  let failed = 0;
  let reply = null;
  const submission = { id: 'product:fail', vendorId: 'toa', submitterDiscordId: '100', type: 'livestock', status: 'pending', media: [], fields: {
    'product/strain name': 'Blue Dream', 'quantity available': '4', 'vendor price': '12.00', 'vendor shipping': '15.00', 'shipping origin': 'Houston, TX', 'doa policy': '2-hour claim',
  } };
  const store = {
    async getLayoutRoles() { return { staffRoleId: 'staff-role' }; },
    async getProductSubmission() { return submission; },
    async claimProductApproval() { return { claimed: true, record: { ...submission, status: 'approval_processing', approvalAttempt: 1 } }; },
    async markProductApprovalPublishing() { return { ...submission, status: 'approval_processing', approvalAttempt: 1, approvalPhase: 'publishing' }; },
    async getVendor() { return { id: 'toa', displayName: 'TOA', catalogSlug: 'toa', active: true }; },
    async failProductApproval() { failed += 1; return { ...submission, status: 'pending' }; },
  };
  const interaction = {
    user: { id: 'staff-user' }, member: { roles: { cache: new Set(['staff-role']) } }, guild: { channels: { cache: [] } },
    commandName: 'product', isChatInputCommand: () => true, deferred: false, replied: false,
    options: { getSubcommand: () => 'review', getString: (name) => name === 'submission' ? 'product:fail' : name === 'action' ? 'approve' : null },
    async reply(value) { this.replied = true; reply = value?.content ?? value; }, async deferReply() { this.deferred = true; }, async editReply(value) { reply = value; },
  };
  const router = createCommandRouter({ config: { discord: { ownerUserId: 'owner' }, marketplace: { defaultMarkupPercent: 5 } }, store, catalog: { async add() { throw new Error('Shopify unavailable'); } } });
  await router.handle(interaction);
  assert.equal(failed, 1);
  assert.match(String(reply ?? ''), /Shopify unavailable/);
});

test('partner cannot edit a submission while approval is processing', async () => {
  let saved = 0;
  let reply = null;
  const store = {
    async getVendorByDiscordUser() { return { id: 'toa', displayName: 'TOA', catalogSlug: 'toa' }; },
    async getProductSubmission() { return { id: 'product:locked', vendorId: 'toa', submitterDiscordId: '100', type: 'livestock', status: 'approval_processing', fields: {}, media: [] }; },
    async saveProductSubmission() { saved += 1; },
  };
  const interaction = {
    user: { id: '100' }, guild: { channels: { cache: [] } }, commandName: 'product', isChatInputCommand: () => true,
    options: { getSubcommand: () => 'fill', getString: (name) => name === 'submission' ? 'product:locked' : 'Product/strain name: X', getAttachment: () => null },
    async reply(value) { this.replied = true; reply = value?.content ?? value; }, async editReply(value) { reply = value; },
  };
  await createCommandRouter({ config: { discord: { ownerUserId: 'owner' }, marketplace: { defaultMarkupPercent: 5 } }, store }).handle(interaction);
  assert.equal(saved, 0);
  assert.match(String(reply ?? ''), /approval_processing|approval/i);
});

test('approval does not claim a durable lease when Discord defer fails', async () => {
  let claims = 0;
  const submission = { id: 'product:defer-fail', vendorId: 'toa', submitterDiscordId: '100', type: 'livestock', status: 'pending', fields: {} };
  const store = {
    async getLayoutRoles() { return { staffRoleId: 'staff-role' }; },
    async getProductSubmission() { return submission; },
    async claimProductApproval() { claims += 1; throw new Error('should not claim'); },
  };
  const interaction = {
    user: { id: 'staff-user' }, member: { roles: { cache: new Set(['staff-role']) } }, guild: { channels: { cache: [] } },
    commandName: 'product', isChatInputCommand: () => true, deferred: false, replied: false,
    options: { getSubcommand: () => 'review', getString: (name) => name === 'submission' ? 'product:defer-fail' : name === 'action' ? 'approve' : null },
    async deferReply() { throw new Error('Discord defer failed'); }, async reply() {}, async editReply() {},
  };
  await createCommandRouter({ config: { discord: { ownerUserId: 'owner' } }, store }).handle(interaction);
  assert.equal(claims, 0);
});

test('Shopify success followed by local completion failure stays reconciliation-required', async () => {
  let failed = 0;
  let marked = 0;
  let catalogCalls = 0;
  const submission = { id: 'product:complete-fail', vendorId: 'toa', submitterDiscordId: '100', type: 'livestock', status: 'pending', media: [], fields: {
    'product/strain name': 'Blue Dream', 'quantity available': '4', 'vendor price': '12.00', 'vendor shipping': '15.00', 'shipping origin': 'Houston, TX', 'doa policy': '2-hour claim',
  } };
  const store = {
    async getLayoutRoles() { return { staffRoleId: 'staff-role' }; }, async getProductSubmission() { return submission; },
    async claimProductApproval() { return { claimed: true, record: { ...submission, status: 'approval_processing', approvalAttempt: 7 } }; },
    async markProductApprovalPublishing() { marked += 1; return { ...submission, status: 'approval_processing', approvalAttempt: 7, approvalPhase: 'publishing' }; },
    async getVendor() { return { id: 'toa', displayName: 'TOA', catalogSlug: 'toa', active: true }; },
    async completeProductApproval() { throw new Error('local completion failed'); }, async failProductApproval() { failed += 1; },
  };
  const interaction = { user: { id: 'staff-user' }, member: { roles: { cache: new Set(['staff-role']) } }, guild: { channels: { cache: [] } }, commandName: 'product', isChatInputCommand: () => true, deferred: false, replied: false,
    options: { getSubcommand: () => 'review', getString: (name) => name === 'submission' ? 'product:complete-fail' : name === 'action' ? 'approve' : null },
    async deferReply() { this.deferred = true; }, async reply() {}, async editReply() {}, };
  const catalog = { async add() { catalogCalls += 1; return { product: { id: 'gid://shopify/Product/99', title: 'Blue Dream', handle: 'toa-blue-dream' }, pricing: {} }; } };
  await createCommandRouter({ config: { discord: { ownerUserId: 'owner' }, marketplace: { defaultMarkupPercent: 5 } }, store, catalog }).handle(interaction);
  assert.equal(marked, 1); assert.equal(catalogCalls, 1); assert.equal(failed, 0);
});