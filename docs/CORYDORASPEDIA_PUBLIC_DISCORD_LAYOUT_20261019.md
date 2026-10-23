# Public Corydoraspedia and Aquapedia Discord layout — 19 October 2026

This records an **executed** one-shot Discord REST change using the *existing* authorized Aquaphoria bot identity on Main PC. No second Gateway client, persistent worker, role change, duplicated research forum, or private-channel migration was performed.

## Existing public research archive preserved

Guild `1519337502379475095` contains the public category **🧬・AQUAPEDIA — SPECIES & GENETICS** (`1561430495680667719`) with existing **🐟・corydoras-research** forum (`1560887812910350339`), historical pinned directory and existing threads. The forum retains its exact ID, parent, tags, and permissions; the publishing source directory is not a verified 528-species list.

## New public community section

**🐟・CORYDORASPEDIA**, category ID `1561938747170492421`. Discord category order was read back as **🐟・MEDAKA & FISH** position 2 → **🐟・CORYDORASPEDIA** position 3 → **🦐・SHRIMP** position 4.

The five new channels, all within this public category:

| Channel | Discord ID | Purpose |
| --- | --- | --- |
| 💬・corydoras-discussion | 1561938748458143754 | Questions, community, ID |
| 🥚・corydoras-breeding | 1561938750131408957 | Eggs, spawn and fry reports |
| 🧬・corydoras-traits | 1561938752333676598 | Lookalikes, traits, C/CW codes, genetics limitations |
| 🩺・corydoras-care | 1561938753969201152 | Species-specific husbandry |
| 📸・corydoras-showcase | 1561938755596718080 | Original rights-owned photos/videos |

## Public Aquapedia channels

Under existing **📚・AQUAPEDIA** category (`1557338241903099945`):

| Channel | Discord ID | Purpose |
| --- | --- | --- |
| 🐟・corydoras-guides | 1561938756896817342 | Corydoraspedia index; points to verified research forum |
| 🔎・research-requests | 1561938758088138793 | Cross-genus research requests with sources |
| 📖・sources-and-credits | 1561938759421923338 | Evidence policy, attribution and photo-use rules |

## Live receipt and privacy

At execution the guild's **@everyone** role had `ViewChannel` and `ReadMessageHistory`. The new category and all eight new channels had **zero permission overwrites**, and Discord GET readback verified exact names, IDs, correct parent-category links and one canonical public Corydoras archive. The layout was created idempotently by inspecting existing names first and aborting on collisions.

An old, **empty private** category named **🔐・CORYDORAS — UNUSED HOLD** (`1560887811962445854`) is left untouched pending separate deletion approval; do not expose its permissions or repurpose it.

## Publishing boundary

The Discord structure is **live**; the Aquapedia website's Corydoraspedia source remains a separate review-stage release. New community channels are not proof that research content has been posted or that `https://aquapedia.app/corydoraspedia/` has deployed. Scientific posts must use the existing source-backed forum publisher, author/marker readback and durable receipts.
