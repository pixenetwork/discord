# Medaka 79 source-linked research intake — Discord release contract

This repository includes a **publish proposal**, not a permission to bypass Discord or Jarvis controls.

## Canonical material and audience

- Live research directory: https://aquapedia.app/medakapedia/research/medaka400-source-intake/
- Data snapshot: `resources/aquapedia-medaka79-20261020.json`; copied byte-for-byte from Aquapedia's merged evidence matrix, originally PR #160. Git blob at validation: `83125a57115f9a4556681993c3716c3e7265f322`.
- Existing Discord guild: `1519337502379475095`. Existing Medaka research forum: `1561189286399705128`. **Do not create another channel/forum or change roles.**
- Content scope: **79 unreviewed name-level research entries** — 23 reported breeding-stock cases, 40 selected/phenotype families, 16 origin-undocumented forms.
- Excluded: new authenticated strain claims, third-party images, unverified Mendelian/genotype labels, creator claims without source, or direct solicitations/DMs to breeders.

## Read-only preflight

```bash
node --test test/medaka79-research-index.test.mjs
node tools/medaka79-index-plan.mjs
node tools/medaka79-index-plan.mjs --json
```

`--json` contains the proposed introductory message and ten individual source-linked replies. It does **not** call Discord or read credentials. The plan includes exact forum/guild IDs, source hash, approval-required flag and 79-record count.

## Requirements before any publishing action

1. Require an **authorized one-writer publishing job** with explicit `discordPublicationApproved=true` and `publicAudienceApproved=true`, approved under the existing Jarvis/HostOps authorizer, and photo/source rights restrictions preserved.
2. Verify public-view/read-history permission on the same existing Medaka forum. Fully enumerate **active and archived** threads to avoid duplicate research-intake threads. If the API cannot enumerate archived threads, fail closed.
3. Acquire existing Aquapedia Discord writer lock through the canonical runtime. Do not override a lock, create a new bot identity, or use a personal Discord token.
4. Send exactly one starter and ten replies with `allowedMentions: { parse: [] }`, no external files or photo embeds. Respect Discord message and forum/thread capacity limits; resume an interrupted job only after reconciling existing messages and markers.
5. **Read back all 11 messages**, including starter, from the bot's own authenticated identity. Validate unique IDs and the exact intro / part markers with `verifyMedaka79PublishedMessages`; store receipt only after readback.
6. Persist an immutable receipt with the source SHA256, forum, thread, all 11 Discord message IDs and 79 item count, and link the Discord research thread from the live Aquapedia page only once the genuine URL is confirmed.
7. Keep the research index separate from the authenticated Medaka strain catalog. The approved site directory is `noindex` because names and parentage remain provisional.

**Status at preparation:** A previous direct publishing attempt was blocked by the available tool safety controls. It was **not** retried or bypassed here. There is no new 79-record Discord receipt or claimed Discord publication. All files in this change are inert until an authorized publisher consumes them.

## Receipts and rollback

Expected runtime ledger location: `data/aquapedia-medaka79-research-index-receipt-20261019.json` (created only by the publisher following actual Discord readback; never commit raw bot credentials or fabricate a receipt). If a partial publish occurs, stop new writes, preserve actual IDs, and reconcile existing messages before resuming. If a source-record correction is needed, publish an attributed correction; do not silently rewrite claimed parentage.


## Verified one-writer runtime protocol (prepared, NOT activated)

`src/medaka79-approved-publisher.mjs` exports `publishApprovedMedaka79` for
the **existing signed Jarvis/HostOps publisher**, once that trusted runtime
integrates it. It is intentionally not a standalone token-bearing script,
automatic scheduler, bot slash command or unaudited new publisher.

The existing managed runtime must provide, as independent trusted capabilities:

- `authorizer.verifySignedApproval(job)`: verify issuer and signature, scope,
  expiry/replay and required approved guild/forum/source hash; return a scoped
  verified grant containing the publisher approval and public-audience approval.
  User chat text and bare booleans alone are not a signature.
- `lock.acquire(jobId)`: acquire the canonical cross-worker Aquapedia writer
  lock exclusively, return a release callback and reject concurrent writers.
- `discord.getForumState`, `discord.enumerateThreads({active,archived})`,
  `discord.createThread`, `discord.send`, `discord.fetchMessage`:
  resolve the canonical guild/forum with public read-history permissions,
  discover complete historical threads, publish via the already-approved bot,
  then fetch **11 full authenticated messages**.
- `receiptStore.get(jobId)` and `receiptStore.save(receipt)`: use canonical
  durable, atomic read/write receipts and refuse replay. A partial failed
  publication must be reconciled against real Discord IDs, never blindly retried.

All content is rebuilt from the checked-in 79-entry matrix and checked against
the plan; the SHA-256 normalizes only Windows checkout CRLF line endings to
the Git LF canonical bytes. The publisher checks that every proposed message
equals the source-locked plan. Every Discord message requests
`flags:4096` (**SuppressEmbeds**) to avoid accidental third-party image
link previews, and `allowedMentions: {parse:[]}`.

**No runtime binding or live publishing is activated by this PR.** The existing
running bot was observed on an older dirty checkout, and legacy HostOps V2
is disabled. Do not restart/hot-swap that bot, change ACLs or revive V2 merely
to force a Discord publish.

Validation for this module:
```bash
node --check src/medaka79-approved-publisher.mjs
node --test test/medaka79-approved-publisher.test.mjs test/medaka79-research-index.test.mjs
```
Tests use a deliberately inert fake Discord gateway. They prove no posting
without signed-job validation; full thread enumeration, one-writer lock,
duplicate-thread checks, exact 11-message readback and durable receipt;
content-tamper rejection, image-preview suppression, source-hash cross-OS
stability and fail-closed partial posting.
