import test from 'node:test';
import assert from 'node:assert/strict';
import { createCollectionService } from '../src/collections.mjs';

function fixture() {
  const calls = [];
  const vendor = {
    id: 'toa',
    discordUserId: '123456789012345678',
    displayName: 'TOA',
    catalogSlug: 'toa',
    active: true,
  };
  let savedVendor = vendor;
  const shopify = {
    async graphql(query, variables = {}) {
      calls.push({ query, variables });
      if (query.includes('AquaphoriaCollections')) {
        return { collections: { nodes: [{ id: 'gid://shopify/Collection/10', title: 'TOA Medaka', handle: 'toa-medaka', updatedAt: '2026-08-08T00:00:00Z' }] } };
      }
      if (query.includes('UpdateAquaphoriaCollection')) {
        return { collectionUpdate: { collection: { id: variables.collection.id, title: 'TOA Medaka', handle: 'toa-medaka', updatedAt: '2026-08-08T00:00:00Z' }, job: null, userErrors: [] } };
      }
      if (query.includes('CreateAquaphoriaCollection')) {
        return { collectionCreate: { collection: { id: 'gid://shopify/Collection/11', title: variables.collection.title, handle: variables.collection.handle, updatedAt: '2026-08-08T00:00:00Z' }, userErrors: [] } };
      }
      throw new Error('unexpected query');
    },
  };
  const store = {
    async getVendor(id) { return id === 'toa' ? savedVendor : null; },
    async listVendors() { return [savedVendor]; },
    async upsertVendor(next) { savedVendor = next; return next; },
  };
  return { service: createCollectionService({ shopify, store }), calls, getVendor: () => savedVendor };
}

test('creates a Shopify collection with a stable slug', async () => {
  const { service, calls } = fixture();
  const collection = await service.create({ name: '3D Printed Products', description: 'Aquarium prints' });
  assert.equal(collection.handle, '3d-printed-products');
  assert.equal(calls[0].variables.collection.title, '3D Printed Products');
  assert.equal(calls[0].variables.collection.descriptionHtml, 'Aquarium prints');
});

test('assigning a vendor adds a vendor-matching collection source and persists permission target', async () => {
  const { service, calls, getVendor } = fixture();
  const vendor = await service.assignVendor('toa', 'TOA Medaka');
  assert.equal(vendor.catalogCollectionId, 'gid://shopify/Collection/10');
  assert.equal(vendor.catalogCollectionTitle, 'TOA Medaka');
  assert.equal(vendor.catalogSlug, 'toa-medaka');

  const update = calls.find((call) => call.query.includes('UpdateAquaphoriaCollection'));
  const source = update.variables.collection.sourcesToCreate[0].source;
  assert.equal(source.targetType, 'PRODUCTS');
  assert.equal(source.inclusion.conditions[0].productVendor.relation, 'EQUALS');
  assert.deepEqual(source.inclusion.conditions[0].productVendor.values, ['TOA']);
  assert.equal(getVendor().catalogCollectionId, 'gid://shopify/Collection/10');
});
