import { calculateRetailBreakdown, moneyToCents } from './pricing.mjs';

export function createCatalogService({ config, store, shopify }) {
  async function assertLocalOwner(vendor, productId) {
    const localOwner = await store.getProductOwner(productId);
    if (localOwner && localOwner !== vendor.id) {
      throw new Error('This product belongs to another vendor catalog');
    }
  }

  async function assertOwned(vendor, productId) {
    await assertLocalOwner(vendor, productId);

    const metadata = await shopify.getVendorMetadata(productId);
    if (!metadata) throw new Error('Shopify product not found');
    if (metadata.vendorId !== vendor.id) throw new Error('This product does not belong to your vendor catalog');
    await store.setProductOwner(productId, vendor.id);
    return metadata;
  }

  async function setPricingMetafields(productId, pricing) {
    const data = await shopify.graphql(
      `mutation SetAquaphoriaVendorPricing($metafields: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $metafields) {
          metafields { namespace key value }
          userErrors { field message code }
        }
      }`,
      {
        metafields: [
          { ownerId: productId, namespace: 'aquaphoria', key: 'vendor_price_cents', type: 'number_integer', value: String(pricing.vendorPriceCents) },
          { ownerId: productId, namespace: 'aquaphoria', key: 'vendor_shipping_cents', type: 'number_integer', value: String(pricing.vendorShippingCents) },
          { ownerId: productId, namespace: 'aquaphoria', key: 'markup_percent', type: 'number_decimal', value: String(pricing.markupPercent) },
        ],
      },
    );
    const errors = data.metafieldsSet.userErrors ?? [];
    if (errors.length) throw new Error(`Shopify pricing metadata update failed: ${errors.map((entry) => entry.message).join('; ')}`);
  }

  return Object.freeze({
    assertOwned,

    async add(vendor, product) {
      const pricing = calculateRetailBreakdown({
        vendorPriceCents: product.vendorPriceCents,
        vendorShippingCents: product.vendorShippingCents,
        markupPercent: product.markupPercent ?? config.marketplace.defaultMarkupPercent,
      });
      const synced = await shopify.upsertVendorProduct({
        vendor,
        product,
        pricing,
        locationId: config.shopify.locationId || null,
        assertExistingOwner: (productId) => assertLocalOwner(vendor, productId),
      });
      await store.setProductOwner(synced.id, vendor.id);
      return { product: synced, pricing };
    },

    async updatePricing(vendor, productId, { vendorPriceCents, vendorShippingCents }) {
      const metadata = await assertOwned(vendor, productId);
      if (!metadata.variantId) throw new Error('Shopify product has no editable variant');
      const pricing = calculateRetailBreakdown({
        vendorPriceCents,
        vendorShippingCents,
        markupPercent: config.marketplace.defaultMarkupPercent,
      });

      const previousRetailCents = metadata.retailPrice ? moneyToCents(metadata.retailPrice) : null;
      await shopify.setProductPrice(productId, metadata.variantId, pricing.retailTotalCents);
      try {
        await setPricingMetafields(productId, pricing);
      } catch (error) {
        if (previousRetailCents != null) {
          await shopify.setProductPrice(productId, metadata.variantId, previousRetailCents).catch(() => undefined);
        }
        throw error;
      }
      return pricing;
    },

    async setStock(vendor, productId, quantity) {
      await assertOwned(vendor, productId);
      return shopify.setProductStock(productId, quantity, config.shopify.locationId);
    },

    async setStatus(vendor, productId, status) {
      await assertOwned(vendor, productId);
      return shopify.setProductStatus(productId, status);
    },

    async list(vendor) {
      const productIds = await store.listVendorProductIds(vendor.id);
      const products = [];
      for (const productId of productIds.slice(0, 50)) {
        const metadata = await shopify.getVendorMetadata(productId).catch(() => null);
        if (metadata?.vendorId === vendor.id) products.push(metadata);
      }
      return products;
    },
  });
}
