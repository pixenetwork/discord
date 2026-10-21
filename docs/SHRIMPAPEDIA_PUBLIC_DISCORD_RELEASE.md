# Shrimpapedia public Discord release

Purpose: publish **14 sourced shrimp breeder dossiers and eight competition summaries**
under **📚・AQUAPEDIA → 🦐・shrimp-research**, as **22 forum threads**.
This is distinct from the existing **🔬・AQUAPEDIA RESEARCH** private workspace
and the earlier legacy/private breeder-forum publisher.

## Current source and status

Aquapedia main contains:

- `research/discord-posts/shrimp-breeder-rich-cards-v1-2026-10-15.json`
  (14 rich breeder cards, review gate closed).
- `research/discord-posts/shrimp-breeders-competitions-batch002-2026-10-15.json`
  (4 overlapping breeder highlights, 8 competition highlights, NOT_POSTED).
- Live canonical public breeder and event pages under
  `https://aquapedia.app/shrimpapedia/`.

`prepareShrimpPublicBatch()` de-duplicates the four repeated breeder summaries,
requires HTTPS sources and photo-rights discipline, preserves original manifests
unchanged, and yields 22 structured cards. Its default return is **review_pending**.
Both editorial and public-audience approval are required for a publishable batch.

Use the **offline, read-only** checker with two locally supplied manifest paths:

```bash
node tools/verify-shrimp-public-batch.mjs <breeder-cards.json> <competition-highlights.json>
```

This checks field limits, source links, mention suppression, unique IDs, text-only
public content and review state. It does not log in, create channels or post.

## Forum provisioning and publication safety

- The existing `📚・AQUAPEDIA` category remains canonical. The layout has
  **one** shared public forum, never one channel per breeder.
- The bot can provision this forum at initialization only when the existing parent
  category can be viewed by the guild's `@everyone` role. Missing/private
  categories are **not created or converted**.
- `publishAquapediaCards()` supports the public forum route only with
  `publicShrimpResearch: true`, `publicAudienceApproved: true`,
  `status: completed`, and `discordPublicationApproved: true`.
- Public-mode records must be shrimp breeder/competition/strain entries with
  HTTPS evidence. It checks `@everyone` view access on the exact forum.
- The existing private publisher route is preserved for backward compatibility.
  No direct unauthenticated network publishing endpoint was added.
- The publisher searches active and archived threads, updates only matching
  bot-owned records, and requires bot-authored message-ID readback before counting
  a post as verified.
- The standalone adapter is *not wired to an automatic publishing trigger*.
  This prevents review-pending source data from being released by deployment.

## Live release checklist

1. Verify the **running Aquaphoria bot's actual startup source, credential injection,
   state directory, owner and governed restart mechanism**. Do not kill the live
   listener or launch a competing bot.
2. Deploy the reviewed code through the verified existing worker; verify `/ready`.
3. Confirm `📚・AQUAPEDIA` and its `🦐・shrimp-research` forum are visible to
   `@everyone`, bot has thread permissions, and private research channels are unchanged.
4. Record explicit editorial/public-audience approval for these **exact** 22 records.
5. Publish **one canary** breeder; read back Discord `threadId`, `messageId`,
   author and record ID and persist its receipt before any remaining batch.
6. Complete the remaining verified posts, recording one receipt per record, with
   retries only after duplicate/readback examination.
7. Do **not** mark source manifests or issue #22 `POSTED` until Discord receipts
   are independently verified. The website being live is not a Discord receipt.

Current release status: **code prepared; Discord posts not yet verified live**.

## Deterministic 22-record publication simulation (no Discord connection)

After downloading the current Aquapedia breeder-card and competition-highlight
JSON manifests to the **same authorized machine**, run:

```sh
node tools/verify-shrimp-public-batch.mjs <breeder-cards.json> <competition-highlights.json>
node tools/verify-shrimp-batch-e2e.mjs <breeder-cards.json> <competition-highlights.json>
```

The second command builds an entirely **in-memory Discord guild/forum mock** from
the actual source records. It tests an approval-closed rejection, one breeder
canary, the remaining 21 records, bot-authored message-ID receipts, and a
second full-batch pass that must edit exactly 22 existing threads with **zero
new duplicate threads**. No Discord token, network credentials, or real bot
process are accessed. The displayed receipt IDs are *synthetic* and must
**never** be logged or represented as live Discord publication evidence.

This test is necessary but not sufficient for live release. The production
worker's exact launch path, authorized credential/state handoff, forum access,
and real Discord readback receipts remain independent deployment gates.

## Owner-controlled release command — October 19, 2026

The bot now includes an owner-only, administrator-visible
`/shrimp-release` command. It is **not** invoked at startup, from HTTP, or
by background automation. Only the configured `AQUAPHORIA_OWNER_USER_ID`
may execute it; rejected users cannot activate the release.

**Inputs:** `data/shrimp-release/breeders.json` and
`data/shrimp-release/competitions.json` are pinned to Aquapedia commit
`2bade20e5a0e80b1c6786c0be6523a2cef92dda7`. The release loader
verifies both SHA-256 checksums before assembling 14 breeder and 8 contest
cards. The checked-in manifests retain `NOT_POSTED` / approval-closed
source metadata and contain no rehosted breeder photographs.

Supported owner actions within the **already running, single-instance bot**:

1. `/shrimp-release status`: private count of actual stored message
   receipts, no Discord post writes.
2. `/shrimp-release canary`: explicit owner action approves exactly the
   first breeder for public release. Publisher verifies the bot author,
   source record ID, Discord thread ID and message ID, then saves a
   canary receipt to the persistent store.
3. `/shrimp-release finish`: explicit owner action may publish the
   remaining 21 only when a verified canary receipt exists for the same
   source revision **and** Discord guild. Stores verified receipts by
   record ID, reports partial/unverified writes without declaring success.

The record key is scoped by source commit and guild ID. Attempts inside
the same Node process are serialized. Once all 22 receipts are stored,
a repeat owner action is read-only. The underlying publisher updates
matching bot-owned posts rather than creating duplicate threads.

**Do not run these actions on a newly spawned competing bot.**
The production service's privileged launcher, credential injection,
persistent `DATA_DIR` and reliable rollback must first be verified.
The code/repository deployment and the Discord publication are separate
release phases. Real public posts are confirmed only by their Discord
thread/message IDs and successful durable-store writes; simulation IDs
do not count.
