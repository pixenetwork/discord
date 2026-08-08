# Aquaphoria Vendor Marketplace

Aquaphoria operates as a curated multi-vendor / dropship marketplace. Aquaphoria owns the storefront, customer checkout, support experience and marketplace rules. Approved breeders/vendors own their catalog inventory and fulfill their own products directly to the customer.

## Supported vendor products

Vendors can list approved aquarium-related products in these initial categories:

- Live fish
- Eggs
- 3D-printed aquarium products
- Fish/shrimp food
- Bacteria and water-care products
- Accessories
- Other approved aquarium goods

## Pricing model

Every vendor listing records the vendor's product price and vendor shipping amount separately.

Default calculation:

`vendor total = vendor product price + vendor shipping`

`Aquaphoria retail = vendor total + 5% markup`

The default markup is controlled by `AQUAPHORIA_DEFAULT_MARKUP_PERCENT` and can be changed without giving vendors control over the public markup.

Example:

- Vendor product price: $100.00
- Vendor shipping: $30.00
- Vendor total/payout basis: $130.00
- Aquaphoria 5% markup: $6.50
- Customer retail: $136.50 before taxes or payment-provider effects

The customer-facing product price is clean, while the worker retains the vendor price, vendor shipping, markup and retail amount as separate auditable values.

### Shipping behavior in v1

The submitted shipping amount is a **per-unit listing shipping amount**. If a customer buys quantity 2, the payout calculation includes that shipping amount twice. Vendors should therefore submit the amount they need per sellable unit/package configuration.

Vendor-managed Shopify products receive the `aquaphoria.shipping_included=true` metafield. Because vendor shipping is already built into the Aquaphoria retail price, Shopify must not add a second normal shipping charge for these products at checkout. Production should place vendor-managed products in an appropriate free/included-shipping profile or equivalent checkout rule before live sales are enabled.

A later shipping-profile phase can support per-order, combined-shipping and destination-based rates without changing product ownership or payout history.

## Product submission template

For manual onboarding or when staff needs to help a vendor, use:

- Breeder/vendor name
- Product/strain name
- Japanese name, when known
- Product category
- Product type/pack size (pair, trio, individual, eggs, grams, bottle size, printed item, etc.)
- Quantity available
- Vendor product price
- Vendor shipping amount
- Sex/ratio for livestock, when applicable
- Size/age for livestock, when applicable
- Lineage/breeder attribution, when known
- Description
- Traits/specifications
- Shipping origin (city/state or country; no private street address in the listing)
- Shipping notes
- DOA policy for livestock, when applicable
- Ingredients/storage/batch or expiry details for food/bacteria products, when applicable
- Material/dimensions/options for 3D-printed products, when applicable
- Actual photos/videos when possible
- Whether Aquapedia research is needed
- Extra notes

Unknown lineage/history should be marked unknown rather than guessed. Aquapedia research is separate from the live sales listing and cannot silently overwrite verified storefront facts.

## Vendor commands

- `/catalog add` — add or sync a product to the vendor's Aquaphoria catalog.
- `/catalog price` — change vendor price + shipping and recalculate Aquaphoria retail.
- `/catalog stock` — update available quantity.
- `/catalog hide` — temporarily draft a listing.
- `/catalog show` — reactivate a listing.
- `/catalog remove` — archive a listing while preserving order/audit history.
- `/catalog list` — list products assigned to the vendor.
- `/order list` / `/order view` — view only that vendor's fulfillment tickets.
- `/order shipped` — add tracking, fulfill only that vendor's line items in Shopify and request customer notification.
- `/order issue` — escalate stock/shipping/DOA/delay problems to Aquaphoria staff.
- `/payout status` — show owed, paid and current vendor balance.
- `/research` — approved vendors/staff can request evidence-backed strain or breeder research for Aquapedia.

## Ownership boundary

A Discord role is not sufficient authorization by itself. Product changes are checked against the vendor ownership metadata stored on the Shopify product. A vendor cannot edit another vendor's product by guessing its Shopify product ID.

New `/catalog add` requests also refuse to claim a pre-existing Shopify handle that does not already belong to that vendor. This prevents a vendor command from silently taking over an unrelated/manual product with a colliding handle.

`/catalog remove` archives instead of hard-deleting products. This preserves historical order references and auditability.

## Paid order flow

1. Customer pays through Aquaphoria/Shopify.
2. Shopify sends the paid-order webhook to the Discord worker.
3. The worker reads each product's Aquaphoria vendor metadata.
4. Mixed-vendor orders are split into separate private vendor tickets.
5. Vendor sees only their items, payout basis and the customer shipping details needed for fulfillment.
6. Aquaphoria sends the vendor payment and marks it paid with `/payout paid`.
7. Vendor ships and runs `/order shipped` with tracking.
8. The worker fulfills only that vendor's Shopify line items and requests customer tracking notification.
9. Fulfillment actions, pricing changes, payouts and exceptions are audit logged.

Webhook deliveries use a durable processing/completed/failed lifecycle. The worker does not acknowledge success before routing completes, concurrent deliveries do not create duplicate tickets, and a failed or stale delivery remains retryable. Ticket creation and the owed payout entry are recorded together; marking a payout paid updates the ledger and ticket state atomically.

## Product model limitation in v1

Vendor-managed products are intentionally treated as a single sellable Shopify variant in this first release. The worker checks this before variant mutations and refuses multi-variant products rather than risk Shopify `productSet` removing variants that were not included in a synchronization request.

Complex size/color/pack variants should be added only after the variant-aware command flow is implemented.
