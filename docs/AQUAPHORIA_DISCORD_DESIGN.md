# Aquaphoria Discord Design

The Aquaphoria Discord is a customer community, support desk, private vendor fulfillment portal, and private Aquapedia research entry point. It is intentionally separate from Pixel Network/FiveM staff operations.

## Core roles

- `Aquaphoria Staff` — customer support, marketplace oversight, order exceptions, collection management support, and audit access.
- `Verified Aquaphoria Vendor` — shared private breeder/vendor area, private Aquapedia research, and vendor commands.
- `Aquaphoria Member` — general community role.
- `Vendor • <name>` — one private role per approved vendor. This role is used for that vendor's private workspace and order tickets.

The owner is identified by `AQUAPHORIA_OWNER_USER_ID` and retains access to all private operational areas.

## Provisioned layout

### 🌊・AQUAPHORIA

- `👋・welcome`
- `📢・announcements`
- `🛒・shop`

Aquapedia is intentionally not exposed in the public section yet.

### 🎫・CUSTOMER SUPPORT

- `🎟️・open-a-ticket`
- `📦・order-help`
- `❓・faq`

Customers use `/ticket open` to create a private support channel. Vendor roles are not granted access to customer support tickets.

### 🐟・BREEDER MARKETPLACE

Hidden from normal members. Visible only to the owner, Aquaphoria staff, and approved vendors.

- `📢・vendor-updates`
- `📖・vendor-guide`
- `🧰・catalog-commands`
- `📦・vendor-orders`
- `💰・payouts`

### 🔬・AQUAPEDIA RESEARCH

Hidden from normal members. Visible only to the owner, Aquaphoria staff, and approved vendors.

- `🔎・research`
- `🧬・research-results`
- `📝・research-queue`

`/research` and authorized `/gpt` requests hand evidence-backed work to Jarvis/Aquapedia. Without a live Jarvis research endpoint, requests are queued for verification rather than represented as completed research.

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

## Catalog permissions

A vendor can be assigned to one Shopify collection/catalog with `/collection assign` or through an owner `/gpt` request. The assignment is persisted and a Shopify collection source is added that matches products whose Shopify vendor is that breeder. This lets new products automatically populate the breeder's catalog while product mutations remain protected by the separate vendor ownership metadata.

A collection cannot be assigned to two active vendors, and a vendor cannot be silently moved from one assigned collection to another.

## GPT access

- Owner: full exposed GPT tool set, including collection creation/assignment and vendor onboarding.
- Aquaphoria staff: read/research GPT tools only.
- Approved vendor: own-catalog/research GPT tools only.
- Normal member: `/gpt` is disabled for now.

GPT tool selection never overrides server authorization.

## Applying the layout

Run `/aquaphoria setup` as the configured owner after the worker is connected to the guild. The provisioner is idempotent: it creates missing roles/categories/channels and synchronizes private permission boundaries without deliberately deleting unrelated existing channels.

This migration is intentionally non-destructive. Legacy channels can be archived after the new layout is verified live.
