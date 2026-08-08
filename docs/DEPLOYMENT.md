# Aquaphoria Discord Worker Deployment

## Runtime

- Node.js 20 or newer
- A persistent writable `DATA_DIR` for vendor/ticket/payout state
- Public HTTPS endpoint that can receive Shopify webhooks

Run:

```bash
npm install
npm run check
npm test
npm start
```

## Discord app

Set:

- `DISCORD_TOKEN`
- `DISCORD_APPLICATION_ID`
- `AQUAPHORIA_GUILD_ID`
- `AQUAPHORIA_OWNER_USER_ID`

The bot needs enough guild permission to provision the requested layout and operate tickets:

- View Channels
- Send Messages
- Read Message History
- Manage Channels
- Manage Roles
- Use/Application Commands
- Embed Links

Keep the bot role above the Aquaphoria roles that it creates or assigns. Do not give the bot Administrator unless the owner deliberately chooses that broader trust level.

After the bot connects, run `/aquaphoria setup` as the configured owner.

## OpenAI `/gpt`

Set:

- `OPENAI_API_KEY`
- `OPENAI_MODEL=gpt-5` (or another Responses API model that supports function tools)

The bot uses the OpenAI Responses API with strict function schemas. GPT decides which allowed tool best matches the natural-language request, but every tool call is re-authorized by server code. Normal members do not receive `/gpt` access in the initial release.

No OpenAI API key belongs in GitHub or Discord messages. Store it only as a runtime secret.

## Shopify Admin API

Set:

- `SHOPIFY_STORE_DOMAIN`
- `SHOPIFY_ADMIN_ACCESS_TOKEN`
- `SHOPIFY_API_VERSION=2026-07`
- `SHOPIFY_WEBHOOK_SECRET`
- `SHOPIFY_LOCATION_ID`

Minimum intended product/collection permissions:

- `read_products`
- `write_products`

The product sync uses Shopify `productSet` and Aquaphoria product metafields. Vendor-managed listings are treated as single-variant products in v1.

The collection layer uses the 2026-07 collections source model. `/collection assign` adds a product-vendor condition source so products whose Shopify vendor matches the approved breeder automatically populate that breeder collection.

New collections are created unpublished by default. Publishing them to the Online Store should be a deliberate storefront step after the catalog is verified.

For order routing and vendor shipment/tracking, the app also needs access to the relevant orders and fulfillment orders. For merchant-managed locations this normally means:

- `read_orders`
- `read_merchant_managed_fulfillment_orders`
- `write_merchant_managed_fulfillment_orders`

If Aquaphoria later fulfills from third-party fulfillment-service locations, grant the matching third-party or assigned fulfillment-order scopes only for the locations/workflow actually used.

The Shopify user/app context also needs permission to create products, create/update collections, and fulfill/ship orders.

### Shipping-included vendor pricing

Vendor-submitted shipping is incorporated into the customer-facing product price before Aquaphoria markup. Vendor-managed products are tagged with Aquaphoria shipping-included metadata. Before enabling live vendor sales, put these products in a Shopify free/included-shipping profile or equivalent checkout rule so Shopify does not charge a second shipping fee.

### Paid-order webhook

Configure Shopify's paid-order webhook to POST to:

`/webhooks/shopify/orders-paid`

The worker verifies the raw request with `X-Shopify-Hmac-Sha256` and `SHOPIFY_WEBHOOK_SECRET` before routing the order.

Do not place Shopify tokens, Discord tokens or webhook secrets in source control.

## Aquapedia

Set:

- `AQUAPEDIA_GITHUB_TOKEN`
- `AQUAPEDIA_REPOSITORY=pixenetwork/aquapedia`
- `AQUAPEDIA_BRANCH=main`

The token must be limited to the permissions needed to read/write Aquapedia contents. The research service rejects paths outside Aquapedia's expected research/data/documentation roots.

Existing Aquapedia files are read first and updated with their current blob SHA; new research records are created normally.

Aquapedia Discord channels remain hidden from normal members in the initial layout.

## Jarvis research integration

Set when the Jarvis research endpoint is available:

- `JARVIS_RESEARCH_ENDPOINT`
- `JARVIS_RESEARCH_API_KEY`

Expected request fields include the request ID, `strain` or `breeder`, the entity name, and evidence requirements. A successful response may include a summary, confidence state, duplicate/alias target, and one or more Aquapedia files to create/update.

If Jarvis research is not configured, `/research` and `/gpt` research requests create a structured verification request under Aquapedia `research/inbox/discord/`. They do **not** claim that research was completed.

## Marketplace settings

`AQUAPHORIA_DEFAULT_MARKUP_PERCENT=5` is the default. It can be changed later without changing vendor ownership records.

`DATA_DIR=./data` stores local runtime state. Production should mount this on persistent storage and back it up because it contains vendor mappings, Shopify collection assignments, ticket state and payout ledger entries. It does not contain Discord/Shopify/OpenAI credentials.

## Go-live order

1. Deploy worker with Discord, Shopify and OpenAI secrets configured.
2. Confirm `GET /health` reports ready and `gptConfigured: true`.
3. Invite/connect the Discord app to the Aquaphoria guild.
4. Run `/aquaphoria setup` and verify Aquapedia + Breeder Marketplace are hidden from normal members.
5. Create a test collection with `/collection create` or `/gpt`.
6. Approve a test vendor with `/vendor add` or `/gpt`.
7. Assign that vendor to the test collection.
8. Create one test Shopify listing through `/catalog add` or `/gpt`.
9. Verify vendor ownership, collection membership, price + shipping + markup, and stock.
10. Send a Shopify paid-order test webhook/order.
11. Confirm the private vendor ticket contains only that vendor's line items.
12. Test payout status and `/order shipped` with a non-customer test order before enabling the workflow for live orders.
