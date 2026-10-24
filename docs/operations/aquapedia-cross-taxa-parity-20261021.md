# Aquapedia cross-taxa Discord parity — evidence audit, 2026-10-21

**Scope:** read-only, current catalog and current Aquaphoria Discord forum inventory.
Tracking issue: https://github.com/pixenetwork/discord/issues/54

## Observed sources
- Live `https://aquapedia.app/assets/catalog.json`: 850 records; Medaka 182, Shrimp 250, Arowana 56, Pleco 167, Corydoras 19, Guppy 176.
- Existing Aquapedia autosync `--check` = zero pending over its **488** permitted Medaka, Shrimp and Arowana records; 318 publisher write receipts; 523 paths in the article watcher and zero changed articles.
- This must **not** be called 850/850 Discord synchronized. Three groups, totaling 362, are excluded from this watcher.
- Read-only Discord REST via already authenticated existing bot; guild `1519337502379475095`; 896 active threads at the audit, below existing soft limit of 950. Archived forum pages enumerated (not just the first page).
- Public Pleco forum `1560931428680601630`: 138 active + 30 archived = **168 threads**; **166 of 167** catalog titles exact-match one existing thread. The remaining catalog label `Pseudolithoxus stearleyi — formerly Soromonichthys` requires alias/manual content reconciliation; do **not** open another thread by default.
- Public Corydoras forum `1560887812910350339`: 417 active + 122 archived = **539 threads**, 3 exact names against the 19 *curated site anchors*. No inference that the 16 remaining anchors lack topical research: forum is species/CW based while site catalog is mainly lineage/breeding reports; content-level reconciliation is still required.
- Public Guppy forum `1562195139353645146`: **7 active overview threads**, 0 archived; zero exact matches to the 176 individual `/guppypedia/entries/gup-###/` records. The seven existing subjects cover water/care, show-tail standards, genetics, controlled breeding, food/fry, disease prevention, Endler/hybrid labels. The correct first publication unit, if approved, is a reviewed **index or update to existing threads**, not 176 automatic new threads.
- Verified Discord thread starters sampled: existing bot-owned messages; Pleco sources already contain research drafts and citation follow-ups. The title match is **not** proof of content, taxon, photo rights or source hash parity.
- Public forum target ≠ authorized publication: source-attributed status and editor review are still required.

## First review-gated source policy
`src/aquapedia-cross-taxa-publication-policy.mjs` provides pure read-only classifiers, strict route/status validation, exact title matching and duplicate guards. It **never writes to Discord**, **never creates threads**, and **never changes the running bot**. It requires any eventual cross-taxa publication to pass independent evidence/editorial and permission checks in the existing Jarvis writer. Changed counts/status/paths must fail closed, not be silently added to the private Medaka/Shrimp publisher.

### Editorial gates to unblock later
1. **Guppy:** 48 site records labeled `Officially standardized phenotype` still need source and scope validation; 128 `Trade label; lineage unverified` must retain their non-pedigree status. Decide public index and allowable cited summary before editing any live thread.
2. **Pleco:** 167 site draft records are *already near-completely represented* by 168 forum threads. Crosswalk stable source IDs, source URLs, updated statuses, alias for `Pseudolithoxus stearleyi`, and full starter-content/edits; do not create 167 new posts.
3. **Corydoras:** review 19 site anchors with source evidence and exact section URL, map to 539 existing species and eight-topic research threads, then update vetted existing threads in-place. Do not present a hash anchor as a standalone article.
4. **Publisher:** the live working autosync scripts remain untracked locally on Main PC. No source policy is applied to that runtime from this PR. Require exact-hash backup, one-writer integration, API readback and durable receipts, all from the already authorized automation, before accepting public release.
5. **Privacy/capacity:** preserve existing private breeder channels and all existing public forum IDs, photo/translation licenses, old message IDs, guild-wide thread headroom, and one scheduler.

**This audit is not scientific verification, a completed AI council review, permission to publish new records, or proof of every forum message's accuracy.**

## October 21, second source-and-alias pass (read-only)

**IKGH primary source:** https://ikgh.org/wp-content/uploads/2023/05/IHS-Version-2023.pdf
- Item 42, page 9 and Supplement 3, page 39: ten explicitly acknowledged base colours correspond to Guppypedia GUP-001–010.
- Supplement 3, items 205 and 207, pages 40–43: 25 catalogued covering colours or named patterns correspond to GUP-011–035. The formal codes are fewer than 25 because the standard groups Half-/Three-quarter Black together; Snakeskin/Lace; Japan/Singa Blue; Blue/Red Grass.
- Items 209–211, page 43: thirteen A1–A5, B1–B4, C1–C4 tail-shape codes correspond to GUP-036–048.
- Original publication describes recognized show-category and phenotype terminology, **not genetically authenticated founder bloodlines**. Every mapped record remains editorial-review-required; 128 commercial Guppy variants GUP-049–176 stay `Trade label; lineage unverified`. The source does not support publishing 176 independent pedigrees.
- The exact-name-and-ordinal `src/aquapedia-guppy-ihs-crosswalk.mjs` fails closed if a standardized name, route or number drifts; it returns `publicationAuthorized:false` always.

**Pleco historical alias resolved:** site https://aquapedia.app/plecopedia/research/soromoni-stearleyi/ identifies `Pseudolithoxus stearleyi` (originally `Soromonichthys stearleyi`), DOI https://doi.org/10.1643/CI-10-008 and California Academy of Sciences Catalog of Fishes. Existing public Discord forum starter: https://discord.com/channels/1519337502379475095/1561147018473381900, titled `Soromonichthys stearleyi — Guiana Shield specialty`, with a later bot-authored research corroboration explicitly using the updated accepted name. One verified legacy alias thread is reused; still a draft, no new post.

**Cory anchored sections verified:** https://aquapedia.app/corydoraspedia/lineages/ and https://aquapedia.app/corydoraspedia/breeding/ returned HTTP 200; each of the 8 lineage and 11 breeding fragment IDs was present in page HTML (19/19). They are sections, not 19 separately fetchable articles; existing 539 forum threads cover a wider species/CW scope, so exact-title matching alone must not guide posting.

**Release status:** Draft PR; changes are source audit and read-only planning only. No new bot, new public threads, media reuse, Discord posts, runtime publisher modifications, permission changes or claims of editorial/source-rights clearance.

## October 21 — Guppypedia index review preview and Cory source-to-thread audit

- A fresh authenticated public Discord bot readback captured the **seven existing Guppypedia topic starters** (all bot-owned, unlocked, unarchived, under forum `1562195139353645146`) in `test/fixtures/guppypedia-forum-starters-20261021.json`; source snapshot SHA256 is recorded in the operation log and no Discord token, private channel message, or personal data was copied. Guild-wide active threads in that readback: **898**.
- Pinned public Aquapedia source fixture contains **176 Guppy entries**, with 48 IKGH 2023 standard-label records and 128 commercial/hobby/hybrid label records still on hold.
- `src/aquapedia-guppy-discord-index-preview.mjs` is a pure, inert review planner. It fails closed if any of seven source-linked thread starters changes identity/ownership/parent/lock/archive status, if the active thread count is unverified or at least 950, or if the 176 site entries drift.
- Four **preview-only** Discord-sized messages fit the two already-existing source-appropriate threads: `Guppypedia — Genetics and Lineage` for 10 base and 25 covering color/pattern records, and `Guppypedia — Show Tail Standards` for 13 tail-form records. All 48 entries are linked to their own public Aquapedia pages and the IKGH source; max draft content 1,871 characters. The 128 trade and hybrid-related labels are excluded. See `docs/operations/guppy-discord-index-preview-20261021.md`. This is **not approval or authorization to send**.
- Cory content audit: **12 single-candidate** forum threads, **seven ambiguous** anchored records (morph vs parent species) and **zero unmatched named candidates** within all 539 species/CW threads. Readback of all 12 single-candidate starters and recent posts found **0/12 exact Aquapedia curated-section backlinks**. See `docs/operations/corydoraspedia-content-parity-20261021.md`. Claim-level source and licensing review remains required before posting or editing; no automatic assignment for ambiguous entries.
- The live Medaka/Shrimp/Arowana publisher remains separate. **No original runtime changes, Discord posts, channel/thread creation, scheduler changes, or checkpoint resets** occurred in this review phase.

## October 21 evening — primary-source Corydoraspedia destination review

- A fresh read-only authenticated capture checked existing public Cory forum threads, source statuses, the current `https://aquapedia.app/assets/catalog.json`, and the two live anchored Corydoraspedia research pages.
- `test/fixtures/corydoraspedia-thread-review-20261021.json` contains only public record/metadata, existing thread IDs, source status, author ownership and a direct-backlink boolean; **no private breeder messages, passwords or tokens**.
- `src/aquapedia-cory-section-link-review.mjs` strictly tests expected 8 lineage/11 breeding sections and the exact read-only candidate snapshot. Inert review output: **10 source-linked existing-thread link drafts**, **7 ambiguous morph/base-species destinations**, and **2 nomenclature/lineage review holds** (`red-laser` and `hoplisoma-weitzmani-breeding`). **Six of ten draft targets are currently archived**, so even a later authorized publisher must assess unarchive permissions/receipts. Any new existing backlink, renamed route, ambiguous duplicate, unauthorized author or changed type/status fails closed.
- Formal taxonomy spelling: Eschmeyer’s Catalog of Fishes recognizes `Hoplisoma weitzmani` (Nijssen, 1971), while the existing Discord thread title uses `weitzmanii`: https://researcharchive.calacademy.org/research/ichthyology/catalog/fishcatget.asp?spid=4922 . Do not assume the forum title is a second valid taxon.
- Evidence of a *reported* red-laser captive line from CW023 orange-stripe fish is in the Catfish Study Group Journal 18(2), June 2017, `The laser corys`: https://www.catfishstudygroup.org/pdf/journal/2017_2.pdf . It describes a selected F2 story; neither a taxonomic species description nor proof of pedigrees of all traded Red Laser stock.
- `tools/render-aquapedia-cory-section-review-20261021.mjs` validates every live source anchor and produces an unposted review-only artifact `docs/operations/corydoraspedia-section-link-preview-20261021.md`. **No Discord writes.** No new bot, runner, scheduler or checkpoint. No external agent/editorial vote is claimed.

## October 21 evening — full Plecopedia exact backlink parity

- Read-only REST enumeration of all **168** existing public Pleco forum threads (138 active, 30 archived) and all **167** site draft records. **167/167** catalog records resolved to exactly one pre-existing thread (166 same-title plus original-name `Soromonichthys stearleyi` → currently accepted `Pseudolithoxus stearleyi`). The remaining forum thread is outside this 167-record site cohort, not automatically a duplicate.
- Audited every mapped existing Discord thread, with authenticated bot-owned starter readbacks; no thread exceeded the newest-25 sample window. Every one contained at least one non-Aquapedia source URL, but cited links alone do **not** prove claim-level scientific reliability.
- **82/167** thread histories already include the exact current Aquapedia article URL; **85/167** do not. **30/85** missing-link targets are archived and would require separate governed permission/unarchive checks. All **85** corresponding public website pages returned HTTP 200.
- `test/fixtures/plecopedia-thread-parity-20261021.json` holds a minimal 167-record URL→thread ID/linked/archive ledger, alongside a public-source catalog snapshot. No personal/private messages or tokens were persisted.
- `src/aquapedia-pleco-backlink-review.mjs` is a pure fail-closed, non-publishing planner: changes to route, draft status, name alias, thread uniqueness, source link history, author verification or incomplete sampled history trigger a refusal. Its outputs never create a thread or authorize a post.
- `tools/render-aquapedia-pleco-link-review-20261021.mjs` validates the live site against the recorded source and produces a source-linked 85-item review table in `docs/operations/plecopedia-source-link-review-20261021.md`. **Zero Discord writes.** Some draft targets are archived; preserving originals and deliberate edit/unarchive approval is required.
- These are missing **backlinks**, not evidence that the Pleco species research is absent. Do not republish 167 threads. Independently verify every source claim and any media rights before linking or changing public research statuses.
