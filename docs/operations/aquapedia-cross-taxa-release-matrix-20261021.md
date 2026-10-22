# Aquapedia cross-taxa release matrix — NOT POSTED

> Editorial and public-audience approval NOT obtained. Snapshot proof is read-only historical evidence; the application has no Discord write logic.

- Catalog checked live: **853** records. Three excluded cohorts: 362 (176 Guppy, 167 Pleco, 19 Corydoras).
- Read-only proposed message/entry count: **99** (Guppy index 4, Cory source links 10, Pleco source links 85).
- Destination states from captured Discord snapshot: 63 active targets, **36 archived targets**.
- Not duplicated: **82 Pleco existing article backlinks**.
- Not included: **128 Guppy trade/hybrid labels**, 7 Cory ambiguous morph/species targets, 2 Cory taxonomic/lineage holds.
- Every proposal includes existing thread ID, public source URL, deterministic content SHA256, unique receipt identity, no-publication header and approval `not-granted`.
- No public messages, no new threads, no edit/unarchive/permission changes, no active publisher integration, no checkpoint updates.

## Evidence age — fresh Discord preflight required

| Cohort | Snapshot age, minutes | Fresh within 60 minutes at audit? |
|---|---:|---|
| guppy | 992 | **No — recheck** |
| cory | 60 | Yes |
| pleco | 50 | Yes |

**This is not a green-light list.** Even recently sampled states can change. All 99 remain blocked until editorial evidence and permission review, conflict-free source/thread readback and approval-gated one-writer release.

## Existing research hold queues

1. Guppy: 48 recognized show-label entries represented in four review-only index drafts; 128 trade/hybrid labels withheld from indexing, pedigree unverified.
2. Cory: ten contextual source links drafted, seven ambiguous morph/species placements, two specific lineage/name issues; six proposed targets are archived.
3. Pleco: 85 missing direct article backlinks after checking 167 existing bot-owned threads, with 30 of the 85 proposed targets archived; 82 already linked, no thread replication.

Complete proposed content and hashes: `resources/aquapedia-cross-taxa-release-review-20261021.json`.

## Live Discord duplicate-check preflight — October 21, 2026

After deterministic review manifest commit `48a78df`, an additional **authenticated read-only REST audit** walked the **97 distinct public Discord threads** referenced by all 99 preview messages. It did not create/modify threads or messages:

- Verified all **97/97** original thread starters belong to the existing Aquaphoria bot.
- All **97/97** message windows were complete within the most recent 25 messages (starter visible in every sampled thread).
- Proposed direct website links still absent **99/99** (4 Guppy index messages, 10 Cory source links, 85 Pleco backlinks). No partial links, no already fully linked proposals.
- Existing archived-target count unchanged: **36 proposed messages** point to archived threads (30 Pleco and 6 Cory), and **0** targets were locked; all archived status checks matched the captured source manifests.
- The user’s original runtime publisher is separate and healthy. This is **not** permission to post and does **not** constitute scientific claim verification, copyright/license clearance, or an approved publisher deployment.
- New reusable `src/aquapedia-cross-taxa-live-preflight.mjs` and `tools/audit-aquapedia-cross-taxa-live-discord.mjs --audit` recheck source counts/labels, bot ownership, real thread parent/lock/archive state and presence of exact links. A changed starter or unsupported source fails closed; no --apply, no write API calls, no scheduler. A 25-message truncation is flagged as incomplete evidence.
- The older Guppy snapshot was more than 16 hours old when the manifest was generated. The live per-target audit closes that *specific thread readback* gap for that timestamp only; any later authorized release must still repeat the preflight and separately obtain editorial/publishing approval and idempotent message receipts.
