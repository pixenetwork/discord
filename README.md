# Pixel Network Discord Workers

Dedicated Discord worker repository for Pixel Network projects.

The first production surface is **Aquaphoria Discord**: customer support, breeder/vendor storefronts, paid-order fulfillment tickets, payouts, Aquapedia research commands, audit logging, and Shopify integration.

Discord-specific runtime code belongs here. Jarvis (`ai-orchestrator`) remains the AI orchestration/control plane, while Aquapedia remains the evidence-backed research knowledge base.

## Aquaphoria architecture

```text
Aquaphoria Discord
  ├─ customer support tickets
  ├─ approved vendor catalogs
  ├─ private vendor fulfillment tickets
  ├─ payout ledger/status
  └─ /research
        │
        ├─ Jarvis research endpoint (when configured)
        │     └─ evidence-backed result
        └───────────────> Aquapedia

Aquaphoria Shopify
  ├─ vendor-owned product metadata
  ├─ customer checkout
  └─ paid-order webhook ──> Discord worker ──> per-vendor tickets
```

## Marketplace model

Aquaphoria is the customer-facing marketplace. Approved vendors can sell live fish/eggs, 3D-printed aquarium products, foods, bacteria/water-care products, accessories, and other approved goods.

Vendors submit their **product price** and **shipping amount**. The worker stores those separately and calculates the customer-facing retail price with the configured Aquaphoria markup. The default is **5%**.

Vendor ownership is enforced against Shopify product metadata before mutations. A vendor cannot edit another vendor's listing by guessing a product ID.

## Commands

### Owner

- `/aquaphoria setup`
- `/vendor add`
- `/vendor list`
- `/vendor disable`
- `/payout paid`

### Approved vendors

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

## Order routing

A paid Shopify order is split by Aquaphoria vendor ownership. Each vendor receives a separate private ticket containing only their products and the shipping details necessary to fulfill them. Payout amounts are recorded from vendor price + vendor shipping. `/order shipped` fulfills only that vendor's Shopify line items, adds tracking, and requests a Shopify customer notification.

## Research

`/research` supports `strain` and `breeder` research. With the Jarvis research endpoint configured, Jarvis performs the source-backed research and returns Aquapedia files to create/update. Without the endpoint, the worker creates a structured Aquapedia research request and clearly reports that it is queued rather than completed.

## Documentation

- `docs/AQUAPHORIA_DISCORD_DESIGN.md` — categories, roles and visibility boundaries.
- `docs/VENDOR_MARKETPLACE.md` — pricing, vendor template, commands and dropship fulfillment flow.
- `docs/DEPLOYMENT.md` — required runtime, Discord, Shopify, Aquapedia and Jarvis configuration.

## Development

```bash
npm install
npm run check
npm test
```

Node.js 20+ is required.

> Never commit credentials. Discord tokens, Shopify Admin tokens, webhook secrets, Aquapedia credentials and Jarvis integration keys are runtime environment variables only.
