import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

const EMPTY_STATE = Object.freeze({
  version: 1,
  vendors: {},
  productOwners: {},
  tickets: {},
  payoutLedger: [],
  researchJobs: {},
});

function freshState() {
  return structuredClone(EMPTY_STATE);
}

export function createStore({ dataDir }) {
  const statePath = path.resolve(dataDir, 'aquaphoria-discord.json');
  let writeQueue = Promise.resolve();

  async function load() {
    await mkdir(path.dirname(statePath), { recursive: true });
    try {
      const parsed = JSON.parse(await readFile(statePath, 'utf8'));
      return { ...freshState(), ...parsed };
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
      if (!vendor?.id || !vendor?.discordUserId || !vendor?.displayName) throw new Error('Vendor id, Discord user id, and display name are required');
      return mutate((state) => {
        const previous = state.vendors[vendor.id] ?? {};
        const normalized = {
          id: String(vendor.id),
          discordUserId: String(vendor.discordUserId),
          displayName: String(vendor.displayName),
          catalogSlug: String(vendor.catalogSlug ?? previous.catalogSlug ?? vendor.id),
          catalogCollectionId: vendor.catalogCollectionId ? String(vendor.catalogCollectionId) : previous.catalogCollectionId ?? null,
          catalogCollectionTitle: vendor.catalogCollectionTitle ? String(vendor.catalogCollectionTitle) : previous.catalogCollectionTitle ?? null,
          discordRoleId: vendor.discordRoleId ? String(vendor.discordRoleId) : previous.discordRoleId ?? null,
          active: vendor.active !== false,
          createdAt: previous.createdAt ?? new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        state.vendors[normalized.id] = normalized;
        return normalized;
      });
    },

    async setProductOwner(shopifyProductId, vendorId) {
      if (!shopifyProductId || !vendorId) throw new Error('Product id and vendor id are required');
      return mutate((state) => {
        state.productOwners[String(shopifyProductId)] = String(vendorId);
        return String(vendorId);
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
      if (!ticket?.key || !ticket?.vendorId || !ticket?.channelId) throw new Error('Ticket key, vendor id, and channel id are required');
      return mutate((state) => {
        const existing = state.tickets[ticket.key] ?? {};
        state.tickets[ticket.key] = {
          ...existing,
          ...ticket,
          key: String(ticket.key),
          vendorId: String(ticket.vendorId),
          updatedAt: new Date().toISOString(),
          createdAt: existing.createdAt ?? new Date().toISOString(),
        };
        return state.tickets[ticket.key];
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
      if (!entry?.vendorId || !Number.isSafeInteger(entry.amountCents)) throw new Error('Payout vendor id and amount cents are required');
      return mutate((state) => {
        const id = entry.id ?? `${entry.vendorId}:${Date.now()}`;
        const existing = state.payoutLedger.find((item) => item.id === id);
        if (existing) return existing;
        const normalized = {
          id,
          vendorId: String(entry.vendorId),
          orderId: entry.orderId ? String(entry.orderId) : null,
          amountCents: entry.amountCents,
          type: entry.type ?? 'owed',
          note: entry.note ?? null,
          createdAt: new Date().toISOString(),
        };
        state.payoutLedger.push(normalized);
        return normalized;
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
        state.researchJobs[String(job.id)] = { ...state.researchJobs[String(job.id)], ...job, updatedAt: new Date().toISOString() };
        return state.researchJobs[String(job.id)];
      });
    },
  });
}
