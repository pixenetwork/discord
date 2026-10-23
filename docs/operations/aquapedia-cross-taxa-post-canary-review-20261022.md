# Aquapedia cross-taxa review — after one verified Guppy canary

**Editorial/workflow review only. No Discord posts, edits, unarchive operations, bot restarts, or production permissions granted.**

The original `resources/aquapedia-cross-taxa-release-review-20261021.json` **must stay unchanged** as a historical 99-proposal snapshot. The original `resources/aquapedia-cross-taxa-active-review-20261022.json` is likewise a **pre-canary 63-active / 36-archived snapshot**, not a current publishing queue.

## Current reconciled candidate counts

- **1 Guppy source-index message already published** to an existing bot-owned thread, with independent readback and durable receipt: [view actual Discord message](https://discord.com/channels/1519337502379475095/1562195157028184178/1562987115036278834). It links GUP-001–010; no breeder/pedigree/genotype claim was verified.
- **98 proposed messages remain**: **62 active-thread review candidates** (**3 Guppy, 4 Corydoras, 55 Pleco**) and **36 archived-thread holds** (**6 Corydoras, 30 Pleco**). This reflects the proposal receipts; it is not 98 unique fish species or 98 authorized posts.
- Active review batching is capped at **12**: exactly **six batches** of **12, 12, 12, 12, 12, 2**. Each `canPublish` remains false; all 36 archived targets stay held. No new threads or forums are requested.
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
