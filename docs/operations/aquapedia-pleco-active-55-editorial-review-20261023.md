# Plecopedia active-thread source review — October 23, 2026

This is a **source-access triage for human reviewers**, not an authorization to publish to Discord or a validation of an article's biological claims.

The 55 previously unposted Plecopedia backlink proposals in the historic [99-proposal manifest](../../resources/aquapedia-cross-taxa-release-review-20261021.json) have been matched with the existing [143-citation URL snapshot](../../resources/aquapedia-cross-taxa-citation-presence-20261021.json) and [109 HEAD results](../../resources/aquapedia-external-source-head-20261022.json). Their **immutable source Git blobs, 55 existing Discord thread IDs, proposal IDs, receipt keys, individual citation URLs, and per-source HEAD observations** are pinned in [the editorial queue](../../resources/aquapedia-pleco-active-55-editorial-review-20261023.json).

| Research-review lane | Active, existing Discord thread candidates | Editorial action |
|---|---:|---|
| At least one DOI-format citation | 29 | Verify that an actual primary paper exists, is relevant to *this specific claim*, and describes the correct taxon/collection |
| Other HEAD-reachable citation(s), without DOI link | 23 | Identify the original first-person observation or scientific authority; attribute hobby reports clearly |
| No HEAD-reachable source | 3 | Alternate lawful access, original author/library verification and site typo checks, but **no automatic source swapping** |
| **Total, still unapproved** | **55** | Claim-level review, rights assessment and live thread readback |

All 55 are **unpublished proposals**; the historical first four Guppy standardized source-index receipts and four Corydoras keeper-report links were already reconciled and must not be reposted. The larger cross-taxa review remains **91 proposals = 55 active Pleco + 36 archived holds (6 Cory, 30 Pleco)**. In the Pleco subset, the other 30 archived targets comprise 3 access-restricted and 27 with at least one HEAD-reachable link. **Do not open archived threads as a side effect of this review.**

## First review steps

1. Start from the original DOI/category or reported breeder/keeper account and independently determine whether the claim in the public Aquapedia **research draft** is accurately supported by the underlying work. A DOI-format URL can point to a taxonomic, ecology, or genetics paper unrelated to the claimed *aquarium breeding* behavior. A 200/300 from HEAD establishes no biological fact.
2. Confirm the exact current accepted genus/species, L-number and historical synonym/alias, collection locality when relevant, and provenance versus retailer/distributor. Do not infer that a coded trade name is a uniquely inherited strain or a founder pedigree.
3. Verify current Discord guild, channel, parent category, complete bot-owned thread history, archiving state, duplicate-link absence, third-party image/photo licensing, and whether the recipient has opted out. Use existing thread IDs, **not forum creation**.
4. Only then request independent reviewer and Jarvis single-writer grant for a separately approved batch. Retain idempotent post receipts, readbacks and explicit no-post decisions. No signed approval means **do not post**.

### L037 correction already staged elsewhere

[The original 2008 species article on SciELO](https://www.scielo.br/j/ni/a/GHTtrjmKNLNRgB9tPVKC8HS/?lang=en) confirms valid *Hypostomus faveolus*. The historic Zenodo ID 17162021 resolves via Zenodo's API to the **canonical treatment 17162022**. [Aquapedia draft PR #246](https://github.com/pixenetwork/aquapedia/pull/246) now cites the original DOI `10.1590/S1679-62252008000300012` and canonical DOI `10.5281/zenodo.17162022`, with the research page still noindexed. This source correction does **not** update live production or grant photo rights. It should be checked on fresh live page/Discord readback *after* an authorized deployment; the old third-party 403 access snapshot remains historically true.

Read-only tests: `node --test test/aquapedia-pleco-active-55-editorial-review.test.mjs` and `npm test`. No source articles or images are copied into this repository; the editorial file holds link metadata and rights/claim flags only.
