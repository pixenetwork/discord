function slugify(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

function throwUserErrors(label, errors = []) {
  if (!errors.length) return;
  throw new Error(`${label}: ${errors.map((entry) => entry.message).join('; ')}`);
}

function normalizeCollectionId(value) {
  const text = String(value ?? '').trim();
  if (text.startsWith('gid://shopify/Collection/')) return text;
  if (/^\d+$/.test(text)) return `gid://shopify/Collection/${text}`;
  return null;
}

function vendorSource(vendor) {
  return {
    source: {
      title: `Aquaphoria vendor: ${vendor.displayName}`,
      description: `Automatically includes products managed by ${vendor.displayName}.`,
      targetType: 'PRODUCTS',
      inclusion: {
        matchType: 'ALL',
        conditions: [
          {
            productVendor: {
              relation: 'EQUALS',
              values: [vendor.displayName],
              matchType: 'ANY',
            },
          },
        ],
      },
    },
  };
}

export function createCollectionService({ shopify, store }) {
  async function list() {
    const data = await shopify.graphql(`query AquaphoriaCollections {
      collections(first: 100, sortKey: UPDATED_AT, reverse: true) {
        nodes { id title handle updatedAt }
      }
    }`);
    return data.collections?.nodes ?? [];
  }

  async function resolve(reference) {
    const raw = String(reference ?? '').trim();
    if (!raw) throw new Error('Collection is required');

    const directId = normalizeCollectionId(raw);
    if (directId) {
      const data = await shopify.graphql(`query AquaphoriaCollectionById($id: ID!) {
        collection(id: $id) { id title handle updatedAt }
      }`, { id: directId });
      if (!data.collection) throw new Error(`Collection ${raw} was not found`);
      return data.collection;
    }

    const normalized = raw.toLowerCase();
    const collections = await list();
    const matches = collections.filter((collection) =>
      collection.handle?.toLowerCase() === normalized ||
      collection.title?.toLowerCase() === normalized ||
      collection.handle?.toLowerCase() === slugify(raw)
    );
    if (!matches.length) throw new Error(`Collection "${raw}" was not found`);
    if (matches.length > 1) throw new Error(`Collection "${raw}" is ambiguous; use its Shopify collection ID`);
    return matches[0];
  }

  async function updateCollection(input) {
    const data = await shopify.graphql(`mutation UpdateAquaphoriaCollection($collection: CollectionUpdateInput!) {
      collectionUpdate(collection: $collection) {
        collection { id title handle updatedAt }
        job { id done }
        userErrors { field message }
      }
    }`, { collection: input });
    throwUserErrors('Shopify collection update failed', data.collectionUpdate?.userErrors);
    if (!data.collectionUpdate?.collection) throw new Error('Shopify collection update returned no collection');
    return data.collectionUpdate.collection;
  }

  return Object.freeze({
    list,
    resolve,

    async create({ name, description = '', handle = null }) {
      const title = String(name ?? '').trim();
      if (!title) throw new Error('Collection name is required');
      const collection = {
        title,
        descriptionHtml: String(description ?? '').trim(),
        handle: slugify(handle || title),
      };
      const data = await shopify.graphql(`mutation CreateAquaphoriaCollection($collection: CollectionCreateInput!) {
        collectionCreate(collection: $collection) {
          collection { id title handle updatedAt }
          userErrors { field message }
        }
      }`, { collection });
      throwUserErrors('Shopify collection creation failed', data.collectionCreate?.userErrors);
      if (!data.collectionCreate?.collection) throw new Error('Shopify collection creation returned no collection');
      return data.collectionCreate.collection;
    },

    async rename(reference, newName) {
      const collection = await resolve(reference);
      const title = String(newName ?? '').trim();
      if (!title) throw new Error('New collection name is required');
      return updateCollection({ id: collection.id, title });
    },

    async assignVendor(vendorId, collectionReference) {
      const vendor = await store.getVendor(vendorId);
      if (!vendor || vendor.active === false) throw new Error(`Active vendor "${vendorId}" was not found`);
      const collection = await resolve(collectionReference);

      if (vendor.catalogCollectionId && vendor.catalogCollectionId !== collection.id) {
        throw new Error(`${vendor.displayName} is already assigned to "${vendor.catalogCollectionTitle ?? vendor.catalogCollectionId}". Use an explicit catalog-move workflow before reassigning.`);
      }

      const vendors = await store.listVendors();
      const conflicting = vendors.find((candidate) =>
        candidate.id !== vendor.id &&
        candidate.active !== false &&
        candidate.catalogCollectionId === collection.id
      );
      if (conflicting) {
        throw new Error(`Collection "${collection.title}" is already assigned to ${conflicting.displayName}`);
      }

      if (vendor.catalogCollectionId !== collection.id) {
        await updateCollection({
          id: collection.id,
          sourcesToCreate: [vendorSource(vendor)],
        });
      }

      return store.upsertVendor({
        ...vendor,
        catalogCollectionId: collection.id,
        catalogCollectionTitle: collection.title,
        catalogSlug: collection.handle || vendor.catalogSlug,
      });
    },
  });
}
