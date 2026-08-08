import crypto from 'node:crypto';
import { centsToMoney } from './pricing.mjs';

function slugify(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 180);
}

function assertConfigured(config) {
  if (!config.storeDomain || !config.accessToken) {
    throw new Error('Shopify is not configured. Set SHOPIFY_STORE_DOMAIN and SHOPIFY_ADMIN_ACCESS_TOKEN.');
  }
}

function graphqlEndpoint(config) {
  return `https://${config.storeDomain}/admin/api/${config.apiVersion}/graphql.json`;
}

function throwUserErrors(label, errors = []) {
  if (!errors.length) return;
  throw new Error(`${label}: ${errors.map((entry) => entry.message).join('; ')}`);
}

export function createShopifyClient(config) {
  async function graphql(query, variables = {}) {
    assertConfigured(config);
    const response = await fetch(graphqlEndpoint(config), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': config.accessToken,
      },
      body: JSON.stringify({ query, variables }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(`Shopify HTTP ${response.status}: ${JSON.stringify(payload)}`);
    if (payload.errors?.length) throw new Error(`Shopify GraphQL: ${payload.errors.map((entry) => entry.message).join('; ')}`);
    return payload.data;
  }

  async function setAquaphoriaMetafields(productId, values) {
    const data = await graphql(
      `mutation MetafieldsSet($metafields: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $metafields) {
          metafields { namespace key value }
          userErrors { field message code }
        }
      }`,
      {
        metafields: [
          { ownerId: productId, namespace: 'aquaphoria', key: 'vendor_id', type: 'single_line_text_field', value: String(values.vendorId) },
          { ownerId: productId, namespace: 'aquaphoria', key: 'vendor_catalog', type: 'single_line_text_field', value: String(values.catalogSlug) },
          { ownerId: productId, namespace: 'aquaphoria', key: 'vendor_price_cents', type: 'number_integer', value: String(values.vendorPriceCents) },
          { ownerId: productId, namespace: 'aquaphoria', key: 'vendor_shipping_cents', type: 'number_integer', value: String(values.vendorShippingCents) },
          { ownerId: productId, namespace: 'aquaphoria', key: 'markup_percent', type: 'number_decimal', value: String(values.markupPercent) },
          { ownerId: productId, namespace: 'aquaphoria', key: 'product_category', type: 'single_line_text_field', value: String(values.category) },
          { ownerId: productId, namespace: 'aquaphoria', key: 'managed_by', type: 'single_line_text_field', value: 'discord_vendor_portal' },
        ],
      },
    );
    throwUserErrors('Shopify metafield update failed', data.metafieldsSet.userErrors);
    return data.metafieldsSet.metafields;
  }

  async function setPrimaryVariant({ productId, variantId, priceCents, locationId = null, stock = null }) {
    if (!variantId) throw new Error('Shopify product has no primary variant');
    const variant = {
      id: variantId,
      price: centsToMoney(priceCents),
    };
    if (locationId && Number.isInteger(stock)) {
      variant.inventoryQuantities = [{ locationId, name: 'available', quantity: stock }];
    }

    const data = await graphql(
      `mutation SyncAquaphoriaPrimaryVariant($input: ProductSetInput!, $identifier: ProductSetIdentifiers!, $synchronous: Boolean!) {
        productSet(input: $input, identifier: $identifier, synchronous: $synchronous) {
          product {
            id
            title
            variants(first: 5) { nodes { id price inventoryQuantity } }
          }
          userErrors { field message code }
        }
      }`,
      {
        input: { variants: [variant] },
        identifier: { id: productId },
        synchronous: true,
      },
    );
    throwUserErrors('Shopify variant sync failed', data.productSet.userErrors);
    return data.productSet.product;
  }

  async function createFulfillment(fulfillment) {
    const data = await graphql(
      `mutation CreateAquaphoriaFulfillment($fulfillment: FulfillmentInput!) {
        fulfillmentCreate(fulfillment: $fulfillment) {
          fulfillment {
            id
            status
            trackingInfo(first: 10) { company number url }
          }
          userErrors { field message }
        }
      }`,
      { fulfillment },
    );
    throwUserErrors('Shopify fulfillment failed', data.fulfillmentCreate.userErrors);
    return data.fulfillmentCreate.fulfillment;
  }

  return Object.freeze({
    graphql,

    async upsertVendorProduct({ vendor, product, pricing, locationId = null }) {
      const handle = product.handle || `${slugify(vendor.catalogSlug)}-${slugify(product.name)}`;
      const input = {
        title: product.name,
        handle,
        descriptionHtml: product.description || '',
        productType: product.category,
        vendor: vendor.displayName,
        status: product.visible === false ? 'DRAFT' : 'ACTIVE',
      };

      if (product.imageUrl) {
        input.files = [{
          originalSource: product.imageUrl,
          alt: `${product.name} — ${vendor.displayName}`,
          filename: `${handle}.jpg`,
          contentType: 'IMAGE',
        }];
      }

      const data = await graphql(
        `mutation UpsertAquaphoriaVendorProduct($input: ProductSetInput!, $identifier: ProductSetIdentifiers, $synchronous: Boolean!) {
          productSet(input: $input, identifier: $identifier, synchronous: $synchronous) {
            product {
              id
              title
              handle
              status
              onlineStoreUrl
              variants(first: 1) { nodes { id price inventoryQuantity } }
            }
            userErrors { field message code }
          }
        }`,
        { input, identifier: { handle }, synchronous: true },
      );

      throwUserErrors('Shopify product sync failed', data.productSet.userErrors);
      let synced = data.productSet.product;
      if (!synced?.id) throw new Error('Shopify product sync returned no product id');
      const variantId = synced.variants?.nodes?.[0]?.id;
      if (!variantId) throw new Error('Shopify product sync returned no primary variant');

      synced = await setPrimaryVariant({
        productId: synced.id,
        variantId,
        priceCents: pricing.retailTotalCents,
        locationId,
        stock: product.stock,
      });

      await setAquaphoriaMetafields(synced.id, {
        vendorId: vendor.id,
        catalogSlug: vendor.catalogSlug,
        vendorPriceCents: pricing.vendorPriceCents,
        vendorShippingCents: pricing.vendorShippingCents,
        markupPercent: pricing.markupPercent,
        category: product.category,
      });

      return { ...data.productSet.product, variants: synced.variants };
    },

    async getVendorMetadata(productId) {
      const data = await graphql(
        `query AquaphoriaVendorProduct($id: ID!) {
          product(id: $id) {
            id
            title
            handle
            status
            variants(first: 1) { nodes { id price inventoryQuantity } }
            vendorId: metafield(namespace: "aquaphoria", key: "vendor_id") { value }
            vendorPrice: metafield(namespace: "aquaphoria", key: "vendor_price_cents") { value }
            vendorShipping: metafield(namespace: "aquaphoria", key: "vendor_shipping_cents") { value }
            markup: metafield(namespace: "aquaphoria", key: "markup_percent") { value }
            category: metafield(namespace: "aquaphoria", key: "product_category") { value }
          }
        }`,
        { id: productId },
      );
      const product = data.product;
      if (!product) return null;
      const variant = product.variants?.nodes?.[0] ?? null;
      return {
        id: product.id,
        title: product.title,
        handle: product.handle,
        status: product.status,
        variantId: variant?.id ?? null,
        retailPrice: variant?.price ?? null,
        inventoryQuantity: variant?.inventoryQuantity ?? null,
        vendorId: product.vendorId?.value ?? null,
        vendorPriceCents: Number.parseInt(product.vendorPrice?.value ?? '0', 10),
        vendorShippingCents: Number.parseInt(product.vendorShipping?.value ?? '0', 10),
        markupPercent: Number(product.markup?.value ?? 0),
        category: product.category?.value ?? null,
      };
    },

    async setProductStatus(productId, status) {
      if (!['ACTIVE', 'DRAFT', 'ARCHIVED'].includes(status)) throw new Error('Invalid Shopify product status');
      const data = await graphql(
        `mutation SetAquaphoriaProductStatus($input: ProductSetInput!, $identifier: ProductSetIdentifiers!, $synchronous: Boolean!) {
          productSet(input: $input, identifier: $identifier, synchronous: $synchronous) {
            product { id title handle status }
            userErrors { field message code }
          }
        }`,
        { input: { status }, identifier: { id: productId }, synchronous: true },
      );
      throwUserErrors('Shopify product status update failed', data.productSet.userErrors);
      return data.productSet.product;
    },

    async setProductPrice(productId, variantId, retailTotalCents) {
      return setPrimaryVariant({ productId, variantId, priceCents: retailTotalCents });
    },

    async setProductStock(productId, quantity, locationId) {
      if (!locationId) throw new Error('SHOPIFY_LOCATION_ID is required for inventory updates');
      if (!Number.isInteger(quantity) || quantity < 0) throw new Error('Stock must be a non-negative integer');

      const productData = await graphql(
        `query AquaphoriaPrimaryVariant($id: ID!) {
          product(id: $id) { variants(first: 1) { nodes { id price } } }
        }`,
        { id: productId },
      );
      const variant = productData.product?.variants?.nodes?.[0];
      if (!variant?.id) throw new Error('Product has no variant to update');
      const currentPriceCents = Math.round(Number(variant.price) * 100);
      if (!Number.isSafeInteger(currentPriceCents) || currentPriceCents < 0) throw new Error('Shopify returned an invalid current price');

      return setPrimaryVariant({
        productId,
        variantId: variant.id,
        priceCents: currentPriceCents,
        locationId,
        stock: quantity,
      });
    },

    async fulfillVendorItems({ orderId, productIds, trackingNumber, trackingCompany = null }) {
      if (!orderId || !productIds?.length || !trackingNumber) throw new Error('Order id, product ids, and tracking number are required');
      const allowedProducts = new Set(productIds.map(String));
      const data = await graphql(
        `query AquaphoriaOrderFulfillmentItems($id: ID!) {
          order(id: $id) {
            id
            name
            fulfillmentOrders(first: 50) {
              nodes {
                id
                status
                assignedLocation { location { id } }
                lineItems(first: 100) {
                  nodes {
                    id
                    remainingQuantity
                    lineItem { id product { id } }
                  }
                }
              }
            }
          }
        }`,
        { id: orderId },
      );
      const order = data.order;
      if (!order) throw new Error('Shopify order not found');

      const byLocation = new Map();
      for (const fulfillmentOrder of order.fulfillmentOrders?.nodes ?? []) {
        const selected = (fulfillmentOrder.lineItems?.nodes ?? [])
          .filter((item) => item.remainingQuantity > 0 && item.lineItem?.product?.id && allowedProducts.has(item.lineItem.product.id))
          .map((item) => ({ id: item.id, quantity: item.remainingQuantity }));
        if (!selected.length) continue;
        const locationId = fulfillmentOrder.assignedLocation?.location?.id ?? 'unknown';
        const list = byLocation.get(locationId) ?? [];
        list.push({ fulfillmentOrderId: fulfillmentOrder.id, fulfillmentOrderLineItems: selected });
        byLocation.set(locationId, list);
      }

      if (!byLocation.size) throw new Error('No unfulfilled Shopify line items matched this vendor ticket');

      const fulfillments = [];
      for (const lineItemsByFulfillmentOrder of byLocation.values()) {
        fulfillments.push(await createFulfillment({
          lineItemsByFulfillmentOrder,
          notifyCustomer: true,
          trackingInfo: {
            number: trackingNumber,
            ...(trackingCompany ? { company: trackingCompany } : {}),
          },
        }));
      }
      return fulfillments;
    },

    verifyWebhook(rawBody, providedHmac) {
      if (!config.webhookSecret) throw new Error('SHOPIFY_WEBHOOK_SECRET is not configured');
      if (!providedHmac) return false;
      const expected = crypto.createHmac('sha256', config.webhookSecret).update(rawBody).digest('base64');
      const left = Buffer.from(expected);
      const right = Buffer.from(String(providedHmac));
      return left.length === right.length && crypto.timingSafeEqual(left, right);
    },

    gidForNumericProductId(productId) {
      return `gid://shopify/Product/${String(productId)}`;
    },

    gidForNumericOrderId(orderId) {
      return `gid://shopify/Order/${String(orderId)}`;
    },
  });
}
