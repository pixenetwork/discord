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
