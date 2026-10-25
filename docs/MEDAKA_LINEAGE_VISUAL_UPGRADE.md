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

No production publish route, scheduler, bot or automatic update is added here. This is a verified rendering and gated planning layer, pending release review and a separate authorized in-place editor execution. No specimen photos are copied without permission.
