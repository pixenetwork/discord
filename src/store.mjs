import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

const EMPTY_STATE = Object.freeze({
  version: 2,
  vendors: {},
  productOwners: {},
  tickets: {},
  payoutLedger: [],
  researchJobs: {},
  webhookEvents: {},
  layoutRoles: null,
});

function freshState() {
  return structuredClone(EMPTY_STATE);
}

function isoTimestamp(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error('A valid timestamp is required');
  return date.toISOString();
}

function migrateState(parsed) {
  const state = {
    ...freshState(),
    ...parsed,
    version: 2,
    vendors: parsed.vendors ?? {},
    productOwners: parsed.productOwners ?? {},
    tickets: parsed.tickets ?? {},
    payoutLedger: parsed.payoutLedger ?? [],
    researchJobs: parsed.researchJobs ?? {},
    webhookEvents: parsed.webhookEvents ?? {},
    layoutRoles: parsed.layoutRoles ?? null,
  };

  for (const [id, record] of Object.entries(parsed.processedWebhooks ?? {})) {
    if (state.webhookEvents[id]) continue;
    const claimedAt = record?.claimedAt ?? new Date(0).toISOString();
    state.webhookEvents[id] = {
      id,
      status: 'failed',
      attempt: 1,
      claimedAt,
      failedAt: claimedAt,
      updatedAt: claimedAt,
      lastError: 'migrated_unconfirmed_claim',
    };
  }

  delete state.processedWebhooks;
  return state;
}

function normalizePayout(entry, now = new Date()) {
  if (!entry?.vendorId || !Number.isSafeInteger(entry.amountCents) || entry.amountCents < 0) {
    throw new Error('Payout vendor id and non-negative amount cents are required');
  }
  return {
    id: String(entry.id ?? `${entry.vendorId}:${Date.now()}`),
    vendorId: String(entry.vendorId),
    orderId: entry.orderId ? String(entry.orderId) : null,
    amountCents: entry.amountCents,
    type: entry.type ?? 'owed',
    note: entry.note ?? null,
    createdAt: isoTimestamp(now),
  };
}

function assertSamePayout(existing, expected) {
  const fields = ['vendorId', 'orderId', 'amountCents', 'type'];
  if (fields.some((field) => existing[field] !== expected[field])) {
    throw new Error(`Payout id ${expected.id} already exists with different accounting data`);
  }
}

function saveTicket(state, ticket, now = new Date()) {
  if (!ticket?.key || !ticket?.vendorId || !ticket?.channelId) {
    throw new Error('Ticket key, vendor id, and channel id are required');
  }
  const key = String(ticket.key);
  const existing = state.tickets[key] ?? {};
  state.tickets[key] = {
    ...existing,
    ...ticket,
    key,
    vendorId: String(ticket.vendorId),
    updatedAt: isoTimestamp(now),
    createdAt: existing.createdAt ?? isoTimestamp(now),
  };
  return state.tickets[key];
}

export function createStore({ dataDir }) {
  const statePath = path.resolve(dataDir, 'aquaphoria-discord.json');
  let writeQueue = Promise.resolve();

  async function load() {
    await mkdir(path.dirname(statePath), { recursive: true });
    try {
      return migrateState(JSON.parse(await readFile(statePath, 'utf8')));
    } catch (error) {
      if (error?.code === 'ENOENT') return freshState();
      throw error;
    }
  }

  async function persist(state) {
    await mkdir(path.dirname(statePath), { recursive: true });
    const temporary = `${statePath}.${process.pid}.tmp`;
    await writeFile(temporary, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
    await rename(temporary, statePath);
  }

  async function mutate(mutator) {
    const operation = writeQueue.then(async () => {
      const state = await load();
      const result = await mutator(state);
      await persist(state);
      return result;
    });
    writeQueue = operation.catch(() => undefined);
    return operation;
  }

  async function getProductOwner(shopifyProductId) {
    const state = await load();
    return state.productOwners[String(shopifyProductId)] ?? null;
  }

  return Object.freeze({
    statePath,

    async getVendorByDiscordUser(discordUserId) {
      const state = await load();
      return Object.values(state.vendors).find((vendor) => vendor.discordUserId === String(discordUserId) && vendor.active !== false) ?? null;
    },

    async getVendor(vendorId) {
      const state = await load();
      return state.vendors[String(vendorId)] ?? null;
    },

    async listVendors() {
      const state = await load();
      return Object.values(state.vendors);
    },

    async upsertVendor(vendor) {
      if (!vendor?.id || !vendor?.discordUserId || !vendor?.displayName) {
        throw new Error('Vendor id, Discord user id, and display name are required');
      }
      return mutate((state) => {
        const key = String(vendor.id);
        const previous = state.vendors[key] ?? {};
        const normalized = {
          id: key,
          discordUserId: String(vendor.discordUserId),
          displayName: String(vendor.displayName),
          catalogSlug: String(vendor.catalogSlug ?? previous.catalogSlug ?? key),
          catalogCollectionId: vendor.catalogCollectionId ? String(vendor.catalogCollectionId) : previous.catalogCollectionId ?? null,
          catalogCollectionTitle: vendor.catalogCollectionTitle ? String(vendor.catalogCollectionTitle) : previous.catalogCollectionTitle ?? null,
          discordRoleId: vendor.discordRoleId ? String(vendor.discordRoleId) : previous.discordRoleId ?? null,
          active: vendor.active !== false,
          createdAt: previous.createdAt ?? new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        state.vendors[key] = normalized;
        return normalized;
      });
    },

    async setProductOwner(shopifyProductId, vendorId) {
      if (!shopifyProductId || !vendorId) throw new Error('Product id and vendor id are required');
      return mutate((state) => {
        const productKey = String(shopifyProductId);
        const vendorKey = String(vendorId);
        const existing = state.productOwners[productKey];
        if (existing && existing !== vendorKey) {
          throw new Error(`Product ${productKey} is already owned by vendor ${existing}; explicit reconciliation is required`);
        }
        state.productOwners[productKey] = vendorKey;
        return vendorKey;
      });
    },

    getProductOwner,

    async listVendorProductIds(vendorId) {
      const state = await load();
      return Object.entries(state.productOwners)
        .filter(([, owner]) => owner === String(vendorId))
        .map(([productId]) => productId);
    },

    async assertProductOwnership(shopifyProductId, vendorId) {
      const owner = await getProductOwner(shopifyProductId);
      if (!owner || owner !== String(vendorId)) throw new Error('This product does not belong to your vendor catalog');
      return true;
    },

    async recordTicket(ticket) {
      return mutate((state) => saveTicket(state, ticket));
    },

    async recordTicketWithPayout(ticket, payout) {
      return mutate((state) => {
        const savedTicket = saveTicket(state, ticket);
        const normalizedPayout = normalizePayout(payout);
        if (normalizedPayout.vendorId !== savedTicket.vendorId) {
          throw new Error('Ticket and payout vendor IDs must match');
        }
        const existingPayout = state.payoutLedger.find((item) => item.id === normalizedPayout.id);
        if (existingPayout) assertSamePayout(existingPayout, normalizedPayout);
        else state.payoutLedger.push(normalizedPayout);
        return { ticket: savedTicket, payout: existingPayout ?? normalizedPayout };
      });
    },

    async getTicket(key) {
      const state = await load();
      return state.tickets[String(key)] ?? null;
    },

    async updateTicket(key, updates) {
      return mutate((state) => {
        const existing = state.tickets[String(key)];
        if (!existing) throw new Error(`Ticket ${key} was not found`);
        state.tickets[String(key)] = { ...existing, ...updates, updatedAt: new Date().toISOString() };
        return state.tickets[String(key)];
      });
    },

    async listVendorTickets(vendorId) {
      const state = await load();
      return Object.values(state.tickets).filter((ticket) => ticket.vendorId === String(vendorId));
    },

    async findVendorTicketByOrderName(vendorId, orderName) {
      const state = await load();
      const normalized = String(orderName).trim().toLowerCase();
      return Object.values(state.tickets).find((ticket) => ticket.vendorId === String(vendorId) && String(ticket.orderName ?? '').trim().toLowerCase() === normalized) ?? null;
    },

    async appendPayout(entry) {
      return mutate((state) => {
        const normalized = normalizePayout(entry);
        const existing = state.payoutLedger.find((item) => item.id === normalized.id);
        if (existing) {
          assertSamePayout(existing, normalized);
          return existing;
        }
        state.payoutLedger.push(normalized);
        return normalized;
      });
    },

    async markTicketPayoutPaid(ticketKey, { vendorId, note = null } = {}) {
      return mutate((state) => {
        const key = String(ticketKey);
        const ticket = state.tickets[key];
        if (!ticket) throw new Error(`Ticket ${ticketKey} was not found`);
        if (vendorId && ticket.vendorId !== String(vendorId)) throw new Error('Ticket does not belong to this vendor');
        if (!Number.isSafeInteger(ticket.payoutCents) || ticket.payoutCents < 0) {
          throw new Error('Ticket payout amount is invalid');
        }

        const now = new Date();
        const expected = normalizePayout({
          id: `paid:${key}`,
          vendorId: ticket.vendorId,
          orderId: ticket.orderId,
          amountCents: ticket.payoutCents,
          type: 'paid',
          note: note ?? `Owner marked ${ticket.orderName ?? key} paid`,
        }, now);
        const existingEntry = state.payoutLedger.find((item) => item.id === expected.id);
        if (existingEntry) assertSamePayout(existingEntry, expected);
        else state.payoutLedger.push(expected);

        const alreadyPaid = ticket.payoutStatus === 'paid' && Boolean(existingEntry);
        state.tickets[key] = {
          ...ticket,
          payoutStatus: 'paid',
          payoutPaidAt: ticket.payoutPaidAt ?? isoTimestamp(now),
          updatedAt: isoTimestamp(now),
        };
        return {
          entry: existingEntry ?? expected,
          ticket: state.tickets[key],
          alreadyPaid,
        };
      });
    },

    async payoutSummary(vendorId) {
      const state = await load();
      const entries = state.payoutLedger.filter((entry) => entry.vendorId === String(vendorId));
      const owed = entries.filter((entry) => entry.type === 'owed').reduce((sum, entry) => sum + entry.amountCents, 0);
      const paid = entries.filter((entry) => entry.type === 'paid').reduce((sum, entry) => sum + entry.amountCents, 0);
      return { owedCents: owed, paidCents: paid, balanceCents: owed - paid, entries };
    },

    async recordResearchJob(job) {
      if (!job?.id) throw new Error('Research job id is required');
      return mutate((state) => {
        state.researchJobs[String(job.id)] = {
          ...state.researchJobs[String(job.id)],
          ...job,
          updatedAt: new Date().toISOString(),
        };
        return state.researchJobs[String(job.id)];
      });
    },

    async claimWebhook(webhookId, { now = new Date(), leaseMs = 5 * 60 * 1000 } = {}) {
      if (!webhookId) throw new Error('Webhook ID is required');
      if (!Number.isSafeInteger(leaseMs) || leaseMs < 1) throw new Error('Webhook lease must be a positive integer');
      const timestamp = isoTimestamp(now);
      const currentTime = new Date(timestamp).getTime();
      return mutate((state) => {
        const key = String(webhookId);
        const existing = state.webhookEvents[key];
        if (existing?.status === 'completed') return { claimed: false, reason: 'completed', existing };
        if (existing?.status === 'processing') {
          const claimedTime = Date.parse(existing.claimedAt ?? existing.updatedAt ?? '');
          if (Number.isFinite(claimedTime) && currentTime - claimedTime < leaseMs) {
            return { claimed: false, reason: 'processing', existing };
          }
        }

        const record = {
          ...existing,
          id: key,
          status: 'processing',
          attempt: (existing?.attempt ?? 0) + 1,
          claimedAt: timestamp,
          updatedAt: timestamp,
          completedAt: null,
          failedAt: null,
          lastError: null,
        };
        state.webhookEvents[key] = record;
        return { claimed: true, record };
      });
    },

    async completeWebhook(webhookId, { now = new Date() } = {}) {
      if (!webhookId) throw new Error('Webhook ID is required');
      return mutate((state) => {
        const key = String(webhookId);
        const existing = state.webhookEvents[key];
        if (!existing) throw new Error(`Webhook ${key} was not claimed`);
        if (existing.status === 'completed') return existing;
        const timestamp = isoTimestamp(now);
        state.webhookEvents[key] = {
          ...existing,
          status: 'completed',
          completedAt: timestamp,
          updatedAt: timestamp,
          lastError: null,
        };
        return state.webhookEvents[key];
      });
    },

    async failWebhook(webhookId, error, { now = new Date() } = {}) {
      if (!webhookId) throw new Error('Webhook ID is required');
      return mutate((state) => {
        const key = String(webhookId);
        const existing = state.webhookEvents[key];
        if (!existing) throw new Error(`Webhook ${key} was not claimed`);
        if (existing.status === 'completed') return existing;
        const timestamp = isoTimestamp(now);
        state.webhookEvents[key] = {
          ...existing,
          status: 'failed',
          failedAt: timestamp,
          updatedAt: timestamp,
          lastError: String(error?.message ?? error ?? 'unknown error').slice(0, 1000),
        };
        return state.webhookEvents[key];
      });
    },

    async getWebhookRecord(webhookId) {
      const state = await load();
      return state.webhookEvents[String(webhookId)] ?? null;
    },

    async setLayoutRoles(roles) {
      if (!roles?.staffRoleId || !roles?.vendorRoleId) throw new Error('Staff and vendor role IDs are required');
      return mutate((state) => {
        state.layoutRoles = {
          staffRoleId: String(roles.staffRoleId),
          vendorRoleId: String(roles.vendorRoleId),
          memberRoleId: roles.memberRoleId ? String(roles.memberRoleId) : null,
        };
        return state.layoutRoles;
      });
    },

    async getLayoutRoles() {
      const state = await load();
      return state.layoutRoles;
    },
  });
}
