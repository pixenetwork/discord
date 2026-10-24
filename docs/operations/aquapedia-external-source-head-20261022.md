# Aquapedia third-party reference accessibility — October 22, 2026

> **HEAD results are indicators only.** A 403 may be bot blocking or an authentication restriction; a 502 may be an upstream or transient failure. Neither proves an article or citation is false or a link permanently dead.

- Source records with citations: 143 (48 Guppy, 10 Cory, 85 Pleco).
- Unique third-party URLs checked: 109.
- Reachable HEAD results: 82.
- Not reachable by HEAD / restricted / transient: 27.
- Source records with at least one HEAD-reachable external citation: 137.
- Source records with no HEAD-reachable citation: 6 (not necessarily broken).
- The original Cory keeper-report set passed 10/10 in its separate dedicated source check.
- Fact-checking, breeder photo rights and independent reviewer approval: **not established**.

## Pages needing alternative access or human source review

- https://aquapedia.app/plecopedia/research/breeder-apistomaster-l134/
- https://aquapedia.app/plecopedia/research/breeder-christophe-l025/
- https://aquapedia.app/plecopedia/research/breeder-davej-l134/
- https://aquapedia.app/plecopedia/research/breeder-karsten-l183/
- https://aquapedia.app/plecopedia/research/l025/
- https://aquapedia.app/plecopedia/research/l037/

Data: `resources/aquapedia-external-source-head-20261022.json`.
No Discord posting, external article republishing, or canonical bot configuration changes occurred.

## October 22 reconciliation with the final 91-proposal queue

The four receipt-verified Guppy source indexes and four receipt-verified Corydoras working-report links are already accounted for; **91 cross-taxa proposals remain**. All **85 Plecopedia** draft backlinks are still review-only: **55 active-thread candidates** and **30 archived-thread holds**. A deterministic offline crosswalk in `src/aquapedia-pleco-source-review-lanes.mjs` separates source access from archive status:

| Review lane | Active existing threads | Archived held | Total |
|---|---:|---:|---:|
| Every cited third-party source restricted/unreachable to HEAD | 3 | 3 | 6 |
| At least one third-party URL responded successfully to HEAD, **claims still unverified** | 52 | 27 | 79 |
| **Total** | **55** | **30** | **85** |

**Three restricted active targets:** breeder-apistomaster-l134, breeder-christophe-l025, breeder-davej-l134. **Three restricted archived targets:** breeder-karsten-l183, l025, l037. Previous bounded GET-status triage returned HTTP 403 for their seven cited references, including PlanetCatfish and DOI redirects; this does **not** establish the claims are wrong or that the URLs are permanently broken. Continue with human/existing publisher access, original-source relevance and rights checks; never auto-switch a citation, claim a license, reopen an archived thread or publish a backlink on the strength of HEAD/GET status alone.

The lane classifier validates the original 99-item review manifest and complete 109-source HEAD evidence; any missing, duplicate or inconsistent inputs fail closed. It never connects to Discord or changes a release flag. New exact-head test `test/aquapedia-pleco-source-review-lanes.test.mjs` verifies the six restrictions and all 85 proposal identities.

