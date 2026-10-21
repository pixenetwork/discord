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
