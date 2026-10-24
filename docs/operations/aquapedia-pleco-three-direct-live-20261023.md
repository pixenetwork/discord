> **LATEST AFTER TWO NOMENCLATURE LINKS (October 23, 2026):** Two independently receipt-verified Plecopedia naming-history references are now public; the 76-pending/40-active counts below are historical. The current read-only backlog is **74 pending = 38 active Pleco + 36 archived Cory/Pleco holds**. See `docs/operations/aquapedia-pleco-two-nomenclature-live-20261023.md` and `tools/read-aquapedia-cross-taxa-current-queue.mjs`. No new scientific pedigrees or permission grants.

# Plecopedia — three original descriptions published as source-only links (October 23, 2026)

**Live verified:** Three source-only directory posts were created using the existing Aquaphoria bot, exclusively in their pre-existing bot-owned, public, active Plecopedia research threads. Each passed exact Discord API author/content readback, was saved to a durable on-host receipt, then rechecked successfully with **action: adopted** rather than duplicating the post.

| Provisional working page | Live original bot message | Original published paper |
|---|---|---|
| *Hypancistrus contradens* | [Read Discord post](https://discord.com/channels/1519337502379475095/1561139081063174268/1563362277623599114) | [Armbruster et al., 2007, original description](https://doi.org/10.1643%2F0045-8511%282007%297%5B62%3AFNHSLF%5D2.0.CO%3B2) |
| *Hypancistrus parkateje* | [Read Discord post](https://discord.com/channels/1519337502379475095/1561146973275426817/1563362337878970448) | [Araújo et al., original Tocantins description](https://doi.org/10.1111/jfb.15971) |
| *Pseudancistrus sidereus* | [Read Discord post](https://discord.com/channels/1519337502379475095/1561174493689548871/1563362345835569214) | [Armbruster, 2004, original taxonomic description](https://doi.org/10.11646/zootaxa.628.1.1) |

Publication boundaries: All linked Aquapedia pages remain **Research draft — independent review pending**. No breeding lineages, trade-label aliases, seller stock or animal species identifications were certified. No breeder photos, copied article text or media attachments were posted. The `Pseudancistrus sidereus` draft acknowledges a generic-placement dispute and the `H. contradens` thread warns that “L201a” is not an official taxon.

**Two notable source risks still held, not synced:**
- *Hypancistrus vandragti* has a current accepted combination, but its 2011 original description named *Micracanthicus vandragti* ([original DOI](https://doi.org/10.1643/ci-10-008); [GBIF accepted combination](https://www.gbif.org/taxon/Q3KHM)). A separate taxonomic-source reconciliation is needed before adding a direct-description link.
- *Panaqolus changae* has a review bibliography linking to a [2014 *Panaqolus purusiensis* redescription](https://doi.org/10.1590/S1679-62252014000100006), **not** an original description of *P. changae*. Hold a direct-description claim until a matching original species source is added.

Runtime evidence: exact original bot author and content were retrieved via authenticated Discord GET; one public source link per existing active thread; all three re-invocations adopted the same message IDs; the shared writer lock was absent after completion. Work/Main source files were byte-identical SHA-256 before invoking the original managed bot.

**Release accounting:** The original frozen 99-proposal manifest remains preserved. Current receipt-reconciled status is **76 pending = 40 active Pleco + 36 archived Cory/Pleco holds**. Of the 76, 70 are Pleco proposals (40 active + 30 archived), six are archived Cory; the separate Guppy trade-label and Cory naming/lineage gaps remain held. These 76 are **not** authorized for bulk release, and no archived threads, new Discord channels, bots, schedulers or media permissions were changed.

Receipt evidence: `resources/aquapedia-pleco-three-direct-live-receipts-20261023.json`, source code `src/aquapedia-pleco-three-direct-reconciliation.mjs`, and current read-only backlog `tools/read-aquapedia-cross-taxa-current-queue.mjs`.
