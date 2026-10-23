> **CURRENT AFTER FIVE PLECO SOURCE-ONLY POSTS — October 23, 2026:** Five further existing-thread Plecopedia research links are verified live and receipt-backed. The prior **91 pending / 55 active** snapshot below is now **historical**, not the active release queue. There are **86 unapproved research proposals left: 50 active Pleco and 36 archived Cory/Pleco**. See docs/operations/aquapedia-pleco-five-source-links-live-20261023.md and the read-only 	ools/read-aquapedia-cross-taxa-current-queue.mjs --queue. No remaining biological claims or archived releases have been approved.

# Aquapedia cross-taxa review — historical state after one Guppy canary

> **CURRENT AFTER CORY RECEIPTS — October 22:** Four additional, independently readback-verified source-only Corydoraspedia report links have now been posted. The Guppy-only **95 pending / 59 active** state described below is therefore **historical**. The current reviewed queue is **91 pending, 55 active Plecopedia backlinks and 36 archived Cory/Pleco holds**. Use the non-writing `node tools/read-aquapedia-cross-taxa-current-queue.mjs --queue` reporter and `resources/aquapedia-cross-taxa-post-cory-review-20261022.json`. The 91 are NOT editorially approved for automatic publication.

> **HISTORICAL SNAPSHOT: superseded by four independently receipt-verified Guppy source-index messages.** The 98 pending proposals and 62 active items below describe the state **after the first Guppy canary only**. For latest reviewed status use [Guppy all-48 live receipt summary](aquapedia-guppy-all-48-ikgh-live-20261022.md), `resources/aquapedia-guppy-all-48-live-release-20261022.json`, and the **pure read-only** `node tools/read-aquapedia-cross-taxa-current-queue.mjs --queue`. As of that later verified receipt: **95 proposals remain, 59 active and 36 archived** (10 Corydoras and 85 Pleco); all 48 IKGH-standard Guppy source links have been posted in four bot-owned messages. Neither version is permission to publish any held research.

**Editorial/workflow review only. No Discord posts, edits, unarchive operations, bot restarts, or production permissions granted.**

The original `resources/aquapedia-cross-taxa-release-review-20261021.json` **must stay unchanged** as a historical 99-proposal snapshot. The original `resources/aquapedia-cross-taxa-active-review-20261022.json` is likewise a **pre-canary 63-active / 36-archived snapshot**, not a current publishing queue.

## Historical post-first-canary candidate counts (superseded)

**Do not run** `tools/report-aquapedia-guppy-all-48.mjs` to inspect existing evidence: that earlier one-time script writes its report with exclusive-create semantics and intentionally refuses to overwrite the existing verified ledger. Use only the `read-aquapedia-cross-taxa-current-queue.mjs` non-writing report above.

- **1 Guppy source-index message already published** to an existing bot-owned thread, with independent readback and durable receipt: [view actual Discord message](https://discord.com/channels/1519337502379475095/1562195157028184178/1562987115036278834). It links GUP-001–010; no breeder/pedigree/genotype claim was verified.
- **98 proposed messages remain**: **62 active-thread review candidates** (**3 Guppy, 4 Corydoras, 55 Pleco**) and **36 archived-thread holds** (**6 Corydoras, 30 Pleco**). This reflects the proposal receipts; it is not 98 unique fish species or 98 authorized posts.
- Active review batching is capped at **12**: exactly **six batches** of **12, 12, 12, 12, 12, 2**. Each `canPublish` remains false; all 36 archived targets stay held. No new threads or forums are requested.
- **Follow-up October 22 source-access check:** the seven distinct third-party URLs supporting those six Pleco pages returned **HTTP 403 on a bounded GET request as well as HEAD** from the authorized Work PC. Sites involved were PlanetCatfish (five URLs), Wiley DOI resolution (one) and Zenodo DOI resolution (one). Responses were inspected for status/final host only, without saving documents; a 403 is an access restriction, **not** evidence the citation is broken, fictitious, or licensed to redistribute. Keep all six Pleco claims on editorial-access review; neither 403 nor a later HTTP 200 can certify a claim. Original links unchanged.
- The six Pleco citations with HEAD-restricted sources previously listed in `docs/operations/aquapedia-external-source-head-20261022.md` remain an additional research/accessibility triage item. A 403 from `HEAD` is not evidence the research URL is invalid.
- All archived, incomplete, or changed source statuses require fresh authenticated readback and review. The historical Guppy receipt is evidence of the earlier event, **not** a live-state snapshot or license to publish anything else.

## Reproduce the evidence without a bot or credentials

From this PR checkout:

```powershell
npm ci --ignore-scripts --no-audit --no-fund
node --test test/aquapedia-cross-taxa-post-canary-staging.test.mjs
node tools/report-aquapedia-cross-taxa-post-canary.mjs
node tools/report-aquapedia-cross-taxa-post-canary.mjs --queue
npm run check
npm test
```

The reporter has no supported writing, approval, release, `--apply`, or unarchive flags. It loads only the **frozen 99-proposal manifest**, **frozen Guppy source fixture**, and **verified historic receipt** in this branch; it derives a new read-only review queue and never rewrites the initial manifest. Source URLs, thread IDs, per-item receipt keys, and held statuses can be inspected using `--queue` without messages or private member information.

Before any future public posting, recheck actual bot identity and permissions, source confidence/rights, exact live thread and message history, active/archived status, concurrency and approved signed Jarvis single-writer grant. No Aegis/Cerberus reviewer signoff is claimed here.
