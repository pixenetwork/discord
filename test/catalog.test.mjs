import test from 'node:test';
import assert from 'node:assert/strict';
import { createCatalogService } from '../src/catalog.mjs';

test('catalog add rejects conflicting local ownership before Shopify mutation', async () => {
  let mutated = false;
  const store = {
    async getProductOwner(productId) {
      assert.equal(productId, 'gid://shopify/Product/123');
      return 'other-vendor';
    },
    async setProductOwner() {
      throw new Error('setProductOwner should not run');
    },
  };
  const shopify = {
    async upsertVendorProduct({ assertExistingOwner }) {
      await assertExistingOwner('gid://shopify/Product/123');
      mutated = true;
      return { id: 'gid://shopify/Product/123', title: 'Test product' };
    },
  };
  const service = createCatalogService({
    config: {
      marketplace: { defaultMarkupPercent: 5 },
      shopify: { locationId: null },
    },
    store,
    shopify,
  });

  await assert.rejects(
    () => service.add({ id: 'toa', catalogSlug: 'toa' }, {
      name: 'Test product',
      vendorPriceCents: 1000,
      vendorShippingCents: 500,
      stock: 1,
    }),
    /belongs to another vendor catalog/,
  );
  assert.equal(mutated, false);
});
