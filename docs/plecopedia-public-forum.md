# Plecopedia — public Aquapedia Discord research forum

## Confirmed 2026-10-17 live destination
- Guild: `1519337502379475095` (existing Aquaphoria guild)
- Category: `📚・AQUAPEDIA`, ID `1557338241903099945`; public, zero restrictive overwrites
- Forum: `🐟・pleco-research`, ID `1560931428680601630`
- Forum link: https://discord.com/channels/1519337502379475095/1560931428680601630
- Index thread, verified and pinned: https://discord.com/channels/1519337502379475095/1560931433680470127
- Published on this pass: 21 separately searchable source-backed research dossiers + one pinned guide (22 total); primary source is Aquapedia research draft PR #21.

## Publication receipts and safety
- Run used the existing, already-authorized Aquaphoria bot REST credentials from the live Main PC configuration, without creating another bot Gateway connection, service or scheduler.
- Each thread starter was read back and checked against its original bot author, exact content, and stable `AQP-PLECO-...` ownership marker.
- Receipt file: `%LOCALAPPDATA%\PixelNetwork\plecopedia-research-receipts-20261017.jsonl`.
- The source file is `tools/pleco-forum-publisher.mjs`. Tests: `node --test test/pleco-forum-publisher.test.mjs` (5/5 passed).
- Running with `--plan --limit=21` is read-only; `--plan --audit --limit=21` also force-checks all 22 live starter messages, exact content/author/marker, a pinned index and public permissions. **The 2026-10-17 audit passed: 22/22.** `--apply --limit=21` discovers active/archived threads and reuses exact owned titles, preventing duplicate threads. `--apply --limit=21 --refresh` edits only already bot-owned marked posts whose source contents changed and stores a revision receipt.
- Guild and category identity must match exactly; parent and forum permissions must be public; a conflicting forum or unowned title blocks publication.
- There are no public photos without explicit reuse permission. Posts are clearly labelled provisional research, not independent Athena/Aegis/Cerberus approvals.

## Initial thread classes
1. Zebra Pleco L046 and L098 historic code
2. Hypancistrus seideli historic code entries L066, L236, L287, L333, L399, L400 (one species, not six)
3. Hypancistrus yudja L174
4. L200 distinct taxa Baryancistrus demantoides and Hemiancistrus subviridis
5. Gold Nugget Baryancistrus xanthellus L018/L085/L177
6. L260 Queen Arabesque; L183 Starlight
7. Captive Ancistrus morphs: Super Red, Albino, Longfin and Calico
8. Wood/diet evidence; Ingo Seidel historic contributions; L/LDA identity primer

## Aftercare
- The original Gold Nugget 2011 description DOI was corrected *in place* to https://doi.org/10.1590/S1679-62252011000200001, with content readback and revision receipt.
- The canonical Aquapedia source dossier is on the existing draft branch `athena/pleco-foundation-20260924`. No master data review or live Aquapedia site publication was performed by this Discord pass.
- Remaining work: expand L/LDA number crosswalk from original sources, separate breeder-origin dossiers, localities and genetics, authorized specimen photos, verifiable primary-source breeding data. Do not represent initial 21 threads as the complete pleco inventory.
- Broader governed queue: Athena research planning -> Jarvis/Legion -> Aegis/Cerberus -> Allie approval -> site/Discord sync with receipts; research thread presence is not itself a verification vote.

## Second public Plecopedia publication — 2026-10-17

- The existing forum was reused; **21 additional source-backed topics** were created with readback verification, bringing the catalog to **42 individual research threads plus a pinned master index, 43 total posts**.
- Full live read-only audit with `node --env-file="<authorized bot configuration>" tools/pleco-forum-publisher.mjs --plan --audit --limit=42`: **`live-audit-passed` with `verifiedPosts:43`, `indexPinned:true`, `publicForum:true`, `publicCategory:true`**.
- New research includes L134 Leopard Frog; L047 Mango; L034 versus L255 Medusa identification; L029 versus L007 Vampire; L102 Snowball; L114 Leopard Cactus; L104/L162 Clown aliases; L014 Sunshine; L190 Royal; L204 Flash; L075/L124/L301; L199; L052/L168; L203; L129; L201; L002; and a cited 2008 firsthand Karsten S. L183 breeding account.
- The new source-coded research records reside in `tools/pleco-research-batch2.mjs`, imported by the existing one-shot publisher. The existing bot, forum and governance boundaries remain unchanged. No parallel publisher or persistent scheduler was created.
- The second batch's exact Discord thread URLs and research source links are in the still-draft Aquapedia PR #21. Independent scientific Aegis/Cerberus review, website publication, cleared photos, and a comprehensive L-number catalog remain pending.
- **Never** confuse 42 research threads with 42 distinct formally described species or a 42-strain genetic pedigree: some aliases intentionally overlap, and provisional taxa remain unresolved.

## Third Plecopedia batch — public Discord completion, 2026-10-17

- Continued **the same** public Discord guild/category/forum `1519337502379475095 / 1557338241903099945 / 1560931428680601630` and authorized Aquaphoria bot; no second Gateway instance or competing background publisher.
- **22 additional research threads** were written by the one-shot publisher with author, exact content and `AQP-PLECO-` marker checks; the original 42 topics were recognized as already present and were not duplicated.
- Updated the pinned master index in place. Full final **read-only public Discord REST audit passed `verifiedPosts:65`, `indexPinned:true`, `publicForum:true`, `publicCategory:true`**. Total = **64 research topics + 1 pinned index**. The topics are not 64 unique scientifically described species.
- Batch-03 records: `tools/pleco-research-batch3.mjs` imported by `tools/pleco-forum-publisher.mjs`; all 10 focused Plecopedia tests passed.
- Aquapedia research dossier is in draft PR #21. Batch-03 source text: `research/plecos/2026-10-17-l-number-crosswalk-batch-03.md`, with all 22 exact live links and status/claim caveats. Additional attributed reports: `research/plecos/2026-10-17-firsthand-breeder-case-studies.md`.
- Examples:
  - L024 *Pseudacanthicus pitanga*: https://discord.com/channels/1519337502379475095/1560954626130448407
  - L025 *Pseudacanthicus pirarara*: https://discord.com/channels/1519337502379475095/1560954629502668895
  - L056 specialist naming correction: https://discord.com/channels/1519337502379475095/1560954721672630424
  - L017 historical taxonomy warning: https://discord.com/channels/1519337502379475095/1560954763015888960
  - L082 *Scobinancistrus raonii*: https://discord.com/channels/1519337502379475095/1560955892772503694
  - L239 *Baryancistrus beggini*: https://discord.com/channels/1519337502379475095/1560955932400427049
  - Christophe Girardet first-person 2009 L025 spawning report: https://discord.com/channels/1519337502379475095/1560955934845440142
- Preserve **draft research**, no unlicensed photographs, no invented taxonomic identities or original breeders, and no fabricated independent Aegis/Cerberus votes. No Aquapedia public website promotion occurred in this pass.
- **Current source-code delivery status:** Plecopedia publisher code, tests and batch sources have been committed to independent [draft GitHub PR #28](https://github.com/pixenetwork/discord/pull/28), created from `main`, without overwriting the diverged Corydoras workstream. PR is **not merged**; public Discord publication is independently documented.

## Fourth Plecopedia batch — final live audit (2026-10-17)

- Reused the same authorized Aquaphoria bot and public `📚・AQUAPEDIA` / `🐟・pleco-research` forum. **20 new** source-backed threads were posted; **64 prior** topics were found and reused without duplicate publication.
- Read-only full audit finished with `live-audit-passed`, **`verifiedPosts:85`** (= **84 research topics + one pinned index**), `indexPinned:true`, `publicForum:true`, and `publicCategory:true`.
- The canonical 20 live Discord topic URLs and original-paper references are indexed under [Aquapedia research batch 04](https://github.com/pixenetwork/aquapedia/blob/athena/pleco-foundation-20260924/research/plecos/2026-10-17-l-number-crosswalk-batch-04.md).
- This batch distinguishes L397 from L398 *Panaqolus tankei*, original L144 from domestic Lemon Ancistrus, unofficial 'L600' from formally allocated L-codes, L128 from L200, valid *Pseudacanthicus nyktos*, and breeder accounts for L046 and L398.
- **Publisher QA:** 15/15 focused tests on Main PC. The reviewing code is in [draft PR #28](https://github.com/pixenetwork/discord/pull/28); the branch intentionally avoids concurrent Corydoras code and requires independent review before merge.
- **Scientific review and site status:** research drafts only. No image rights asserted, no unlicensed photos copied, no verified genetics/pedigrees invented, independent Aegis/Cerberus review pending, and no live Aquapedia website deployment in this pass.


## Fifth Plecopedia batch — completed public audit (2026-10-17)

- Existing Aquaphoria bot published **20** more source-backed topics through the same single-writer, REST-only public Plecopedia forum publisher. The prior **84** topics were identified by bot-owned topic marker and reused (no duplicates). New records in `tools/pleco-research-batch5.mjs`; publisher now imports batch 2–5 plus original baseline.
- End-to-end independent read-only Discord API audit: **`live-audit-passed`, `verifiedPosts:105`, `indexPinned:true`, `publicForum:true`, `publicCategory:true`**. Exactly **104 research-topic starters + 1 pinned master index**.
- 20/20 focused local Node.js tests passed in the Main PC source worktree, covering uniqueness, aliases, historic waterbody differences, Panaque titan L418 versus provisional Colombian L191, Xingu L083 uncertainty, 2025 *Peckoltia amjikin* without fabricated L038, and the 2024-online/2025-volume L333 study.
- Exact public thread links and original taxonomic/hobby research citations are indexed in [Aquapedia fifth-batch research](https://github.com/pixenetwork/aquapedia/blob/athena/pleco-foundation-20260924/research/plecos/2026-10-17-l-number-crosswalk-batch-05.md).
- Code changes uploaded to this separate **draft PR #28**, with no force push to the diverged Corydoras PR #26 branch. No secondary Discord worker, bot login, timer or duplicated gateway was created.
- **Still not complete:** exhaustive L/LDA list, independent Aegis/Cerberus scientific review, credited/licensed specimen imagery, verified captive pedigree and live website publish. Public posts remain labeled research draft; **104 forum dossiers are not 104 different scientifically validated species**.


## Sixth batch — 126/126 live audit (2026-10-17)

- Used existing Aquaphoria bot with one-shot REST-only publisher; **21 new starter threads** bot-authored, hash and content readback-verified, **104 earlier topics reused** without duplication.
- Full independent read-only Discord check returned `live-audit-passed`, `verifiedPosts:126`, `indexPinned:true`, `publicForum:true`, `publicCategory:true`: **125 topic threads + one pinned guide** in same public Aquapedia forum.
- Original scientific review of L274/Baryancistrus isaaci and L384/B. quilombola from the 2025 Trombetas revision; original descriptions of Peckoltia, Hypancistrus, and Guyanancistrus included. No copyrighted specimen images copied.
- Publisher imports `tools/pleco-research-batch6.mjs`, QA 24/24 focused tests and read-only preflight selected 125. Sixth batch details and each exact public link in [Aquapedia source dossier](https://github.com/pixenetwork/aquapedia/blob/athena/pleco-foundation-20260924/research/plecos/2026-10-17-l-number-crosswalk-batch-06.md).
- Review branch remains **draft PR #28**, distinct from concurrent Corydoras PR, not merged. Aegis/Cerberus independent science check and public Aquapedia website release have **not** been verified.
