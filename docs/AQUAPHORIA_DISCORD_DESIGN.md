# Aquaphoria Discord Design

The Aquaphoria Discord is a customer community, support desk, vendor fulfillment portal, and Aquapedia research entry point. It is intentionally separate from Pixel Network/FiveM staff operations.

## Core roles

- `Aquaphoria Staff` — customer support, marketplace oversight, order exceptions and audit access.
- `Verified Aquaphoria Vendor` — shared private breeder/vendor area and vendor commands.
- `Aquaphoria Member` — general community role.
- `Vendor • <name>` — one private role per approved vendor. This role is used for that vendor's private workspace and order tickets.

The owner is identified by `AQUAPHORIA_OWNER_USER_ID` and retains access to all private operational areas.

## Provisioned layout

### 🌊・AQUAPHORIA

- `👋・welcome`
- `📢・announcements`
- `🛒・shop`
- `🧬・aquapedia`

### 🎫・CUSTOMER SUPPORT

- `🎟️・open-a-ticket`
- `📦・order-help`
- `❓・faq`

Customers use `/ticket open` to create a private support channel. Vendor roles are not granted access to customer support tickets.

### 🐟・BREEDER MARKETPLACE

Visible only to the owner, Aquaphoria staff, and approved vendors.

- `📢・vendor-updates`
- `📖・vendor-guide`
- `🧰・catalog-commands`
- `📦・vendor-orders`
- `💰・payouts`

### 🔬・AQUAPEDIA RESEARCH

- `🔎・research`
- `🧬・research-results`
- `📝・research-queue`

`/research type:strain name:<name>` and `/research type:breeder name:<name>` hand work to Jarvis when the research endpoint is configured. Results are written or updated in Aquapedia using its evidence rules. Without a live Jarvis endpoint, the command creates a source-verification request in Aquapedia's Discord research inbox rather than fabricating a result.

### 🛡️・AQUAPHORIA STAFF

Visible only to owner/staff.

- `🧾・audit-log`
- `🚨・order-issues`
- `💳・payout-log`
- `🤖・bot-log`

## Per-vendor workspace

Every approved vendor receives a private category such as `🐟・TOA HQ` with:

- `📦・orders` — vendor fulfillment information.
- `🛍️・catalog` — catalog management discussion.
- `💬・vendor-chat` — private vendor ↔ Aquaphoria communication.

Only that vendor's private role, Aquaphoria staff and the owner can view the workspace.

When a paid Shopify order contains multiple vendors, the worker creates a separate fulfillment ticket for each vendor. A vendor receives only their own products and the shipping information needed to fulfill their part of the order.

## Applying the layout

Run `/aquaphoria setup` as the configured owner after the worker is connected to the guild. The provisioner is idempotent: it creates missing roles/categories/channels and synchronizes channel topics without deliberately deleting unrelated existing channels.

This first migration is intentionally non-destructive. Once the new layout is verified live, legacy channels can be archived manually or through a separate migration step.
