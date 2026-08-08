# Pixel Network Discord Workers

Dedicated Discord worker repository for Pixel Network projects.

The first production surface is **Aquaphoria Discord**: customer support, breeder/vendor storefronts, paid-order fulfillment tickets, payouts, private Aquapedia research, audit logging, Shopify integration, and a scoped OpenAI `/gpt` control layer.

Discord-specific runtime code belongs here. Jarvis (`ai-orchestrator`) remains the AI orchestration/control plane, while Aquapedia remains the evidence-backed research knowledge base.

## Aquaphoria architecture

```text
Aquaphoria Discord
  ├─ customer support tickets
  ├─ private breeder marketplace
  ├─ private vendor fulfillment tickets
  ├─ private Aquapedia research
  ├─ payout ledger/status
  └─ /gpt natural-language control
        ├─ Shopify collections/catalogs
        ├─ vendor onboarding/permissions
        ├─ vendor-owned products
        └─ Aquapedia research

Aquaphoria Shopify
  ├─ collections / breeder catalogs
  ├─ vendor-owned product metadata
  ├─ customer checkout
  └─ paid-order webhook ──> Discord worker ──> per-vendor tickets
```

## Marketplace model

Aquaphoria is the customer-facing marketplace. Approved vendors can sell live fish/eggs, 3D-printed aquarium products, foods, bacteria/water-care products, accessories, and other approved goods.

Vendors submit their **product price** and **shipping amount**. The worker stores those separately and calculates the customer-facing retail price with the configured Aquaphoria markup. The default is **5%**.

Vendor ownership is enforced against Shopify product metadata before mutations. A vendor cannot edit another vendor's listing by guessing a product ID.

Each vendor can also be assigned a specific Shopify collection/catalog. The assignment is stored internally and the worker adds a Shopify collection source matching that vendor, so products created under that breeder automatically belong to the assigned breeder collection.

## GPT control

`/gpt` sends natural-language requests to the OpenAI Responses API with strict function tools. GPT interprets the request, but server code remains authoritative for permissions and execution.

Examples:

- `/gpt prompt:create a collection called TOA Medaka`
- `/gpt prompt:add @John as TOA and give him the TOA Medaka catalog`
- `/gpt prompt:list all breeders and which collection they control`
- `/gpt prompt:add Ice Block for TOA at $100 plus $30 shipping, stock 5` with an optional image attachment
- `/gpt prompt:research Ice Block and add verified results to Aquapedia`

Owner, staff, and vendor access are scoped differently. Vendors can only mutate their own catalog. Staff receive read/research tools. Owner-only actions such as creating collections or onboarding vendors remain owner-only even when GPT requests them.

## Commands

### Owner

- `/gpt`
- `/aquaphoria setup`
- `/collection create`
- `/collection list`
- `/collection assign`
- `/collection rename`
- `/vendor add`
- `/vendor list`
- `/vendor disable`
- `/payout paid`

### Approved vendors

- `/gpt`
- `/catalog add`
- `/catalog price`
- `/catalog stock`
- `/catalog hide`
- `/catalog show`
- `/catalog remove`
- `/catalog list`
- `/order list`
- `/order view`
- `/order shipped`
- `/order issue`
- `/payout status`
- `/research`

### Customers

- `/ticket open`

## Visibility

Aquapedia channels are hidden from normal members. The Breeder Marketplace is also private. The owner and Aquaphoria staff can see private operational areas; approved vendors can see the breeder/research areas and only their own vendor HQ/order data.

## Order routing

A paid Shopify order is split by Aquaphoria vendor ownership. Each vendor receives a separate private ticket containing only their products and the shipping details necessary to fulfill them. Payout amounts are recorded from vendor price + vendor shipping. `/order shipped` fulfills only that vendor's Shopify line items, adds tracking, and requests a Shopify customer notification.

## Research

`/research` and authorized `/gpt` requests support `strain` and `breeder` research. With the Jarvis research endpoint configured, Jarvis performs the source-backed research and returns Aquapedia files to create/update. Without the endpoint, the worker creates a structured Aquapedia research request and clearly reports that it is queued rather than completed.

## Documentation

- `docs/AQUAPHORIA_DISCORD_DESIGN.md` — categories, roles and visibility boundaries.
- `docs/VENDOR_MARKETPLACE.md` — pricing, vendor template, collections/catalogs, commands and dropship fulfillment flow.
- `docs/DEPLOYMENT.md` — required runtime, Discord, Shopify, OpenAI, Aquapedia and Jarvis configuration.

## Development

```bash
npm install
npm run check
npm test
```

Node.js 20+ is required.

> Never commit credentials. Discord tokens, Shopify Admin tokens, OpenAI API keys, webhook secrets, Aquapedia credentials and Jarvis integration keys are runtime environment variables only.
