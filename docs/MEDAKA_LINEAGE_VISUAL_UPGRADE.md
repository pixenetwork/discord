# Medaka lineage Discord visual cards — in-place upgrade

## Current operational state
- Public browser channel: https://discord.com/channels/1519337502379475095/1563764327037669416
- Existing Medaka forum: `1561189286399705128`
- The prior portrait-tree publication job was **stopped** after its 144th verified index message; DO NOT automatically resume it or its one-shot launcher.
- Aquapedia revision supplying the landscape pictured-tree design and 170-record source manifest is proposed separately in PR #319 (draft, not live).

## Card layout

Each Discord message should show one cohesive native embed (not walls of plain Markdown):
- Strain name + lineage research status in header
- Wide Aquapedia-owned horizontal SVG rendered to a PNG attachment and displayed inline
- Breeder-reported source lines / selection stages, never unverified genotype claims
- Original breeder/publisher source with direct link and evidence-limit note
- Three URL action controls when sourced: *Full strain profile*, *Original source*, *Strain discussion*
- Unknown parentage omits the Original source control and says `Parent lines not documented`
- Stable footer marker `AQUAPEDIA-MEDAKA-CARD-V1:<canonical-strain-slug>` for readback and future reconciliation

## Upgrade gates

`src/medaka-lineage-card.mjs` builds native Discord payloads; `src/medaka-lineage-card-plan.mjs` derives an **edit-only plan** from original bot-generated publication receipts. These modules make no API calls. An explicit authorized, exclusive writer must verify every existing original/index pair and update it **in place**, with fresh source HEAD, current bot identity, lock ownership and Discord readback. Never create a new channel, post a duplicate message, consume unknown message IDs or resume old source versions. Backfilled records without publication receipts are held, not invented.

A single-use **edit-only** operator script is provided at `tools/apply-medaka-lineage-cards.mjs`, with the canonical bot runtime wrapper `tools/run-visual-edit.ps1`. Dry run is the default. `-Apply` requires owner authorization, audits existing channel/thread ownership and exact receipt-backed message IDs, obtains an exclusive visual-upgrade lock, and writes per-message verified receipts to `reports/medaka-lineage-visual-v3-receipts.json`. It never calls Discord POST, never creates threads, and it stops on any unexpected message or missing source. Discord can promote an embedded uploaded PNG to `embeds[0].image` with an empty `attachments` array; both states are handled and verified. The upgrade preserves message IDs and back-links. The old vertical publisher must never be resumed. No specimen photos are copied without permission.

The remaining 26 records without prior publication receipts are deliberately held outside this editor; a separate deduplication and forum verification pass is required before any new publication. This tool makes no production bot/scheduler installation. The Aquapedia website PR is separately governed.
