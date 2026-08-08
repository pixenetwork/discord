# Aquaphoria Discord Worker Deployment

## Runtime

- Node.js 20 or newer
- A persistent writable `DATA_DIR` for the vendor/ticket/payout state file
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

## Shopify Admin API

Set:

- `SHOPIFY_STORE_DOMAIN`
- `SHOPIFY_ADMIN_ACCESS_TOKEN`
- `SHOPIFY_API_VERSION=2026-07`
- `SHOPIFY_WEBHOOK_SECRET`
- `SHOPIFY_LOCATION_ID`

Minimum intended product permissions:

- `read_products`
- `write_products`

The product sync uses Shopify `productSet` and Aquaphoria product metafields. Vendor-managed listings are treated as single-variant products in v1. The worker verifies existing handles/ownership before an upsert and refuses multi-variant catalog mutations rather than risk destructive list synchronization.

For order routing and vendor shipment/tracking, the app also needs access to the relevant orders and fulfillment orders. For merchant-managed locations this normally means:

- `read_orders`
- `read_merchant_managed_fulfillment_orders`
- `write_merchant_managed_fulfillment_orders`

If Aquaphoria later fulfills from third-party fulfillment-service locations, grant the matching third-party or assigned fulfillment-order scopes only for the locations/workflow actually used.

The Shopify user/app context also needs permission to create products and fulfill/ship orders.

### Shipping-included vendor products

Vendor shipping is included in the calculated Aquaphoria retail amount. The worker marks those products with `aquaphoria.shipping_included=true`.

Before live vendor sales are enabled, configure Shopify so these products do not receive a second normal shipping charge at checkout. Use an appropriate free/included-shipping profile or equivalent checkout rule for Aquaphoria vendor-managed products. Test a mixed-vendor cart before launch.

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

## Jarvis research integration

Set when the Jarvis research endpoint is available:

- `JARVIS_RESEARCH_ENDPOINT`
- `JARVIS_RESEARCH_API_KEY`

Expected request fields include the request ID, `strain` or `breeder`, the entity name, and evidence requirements. A successful response may include a summary, confidence state, duplicate/alias target, and one or more Aquapedia files to create/update.

If Jarvis research is not configured, `/research` still creates a structured verification request under Aquapedia `research/inbox/discord/`. It does **not** claim that research was completed.

## Marketplace settings

`AQUAPHORIA_DEFAULT_MARKUP_PERCENT=5` is the default. It can be changed later without changing vendor ownership records.

`DATA_DIR=./data` stores local runtime state. Production should mount this on persistent storage and back it up because it contains vendor mappings, ticket state and payout ledger entries. It does not contain Discord/Shopify credentials.

## Go-live order

1. Deploy worker with secrets configured.
2. Confirm `GET /health` reports ready.
3. Invite/connect the Discord app to the Aquaphoria guild.
4. Run `/aquaphoria setup`.
5. Approve a test vendor with `/vendor add`.
6. Create one hidden/test Shopify listing through `/catalog add`.
7. Verify vendor ownership, price + shipping + markup, stock, and `shipping_included` metadata.
8. Verify the vendor shipping profile/checkout rule does not double-charge shipping.
9. Send a Shopify paid-order test webhook/order.
10. Confirm the private vendor ticket contains only that vendor's line items.
11. Test `/payout paid` and `/order shipped` with a non-customer test order before enabling the workflow for live orders.
