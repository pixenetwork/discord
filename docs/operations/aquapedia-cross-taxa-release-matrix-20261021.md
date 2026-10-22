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

## Public source citation-presence and original-reference link check — October 21

This pass audited the content linked from the **99 proposed review messages** without publishing anything.

- Parsed the live HTML from **134 unique HTTP-200 Aquapedia pages**, corresponding to **143 distinct proposed public source URLs** (48 Guppy entry URLs, 10 Cory anchored keeper-report sections, 85 Pleco article URLs).
- **143/143** of those scoped URLs exposed at least one explicit third-party citation link, across **32 distinct external hostnames**. Internal Aquapedia links, Discord redirects and Cloudflare analytics were excluded from source counts.
- The ten Cory keeper-report citations were extracted from their **individual article/anchor blocks**, not from a common bibliography elsewhere on the same page.
- A separate **HTTP HEAD-only** check found **10/10** of those original Cory report URLs accessible (200). The check did not download their PDFs or reuse their content.
- Full evidence: `resources/aquapedia-cross-taxa-citation-presence-20261021.json` and `resources/aquapedia-cory-breeding-source-head-20261021.json`. Regeneration scripts enforce source URL counts and are read-only.
- **Do not upgrade source-presence to factual verification.** Guppy source `IKGH 2023` establishes recognized show phenotypes, not genotype/pedigree. Cory keeper accounts do not establish universal care targets. Pleco literature/retailer/hobby links have different evidentiary strengths and each contested claim still requires editorial review. Image/media rights remain unverified for every cohort.
- No Discord messages, forum threads, bot configuration, scheduler, or publisher checkpoints changed. `publicationAuthorized:false` still applies to all proposed outputs.
