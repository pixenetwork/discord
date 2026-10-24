# Plecopedia live page and citation parity — October 23, 2026

**Read-only audit:** All **55** previously identified active-thread Plecopedia research-link candidates were re-fetched from the **live** Aquapedia website. Every source-page URL returned HTTP 200, every record continued to display **Research draft — independent review pending**, and each page retained **exactly the cited external URLs** in its previously stored editorial source inventory. No missing citations, no added citations, and no source-page errors.

The check used `src/aquapedia-source-citation-audit.mjs` to extract explicit external links from the individual public article HTML. It did not follow third-party URLs, download PDFs or fish photos, or post to Discord. A valid external link and a registered DOI are **not** a fact check, independent breeder authentication, species-ID proof, or media permission.

Cross-reference evidence:
- `resources/aquapedia-pleco-active-55-editorial-review-20261023.json`: source confidence/claim holds and 55 existing public thread IDs.
- `resources/aquapedia-pleco-24-doi-bibliography-recheck-20261023.json`: Crossref/DataCite bibliographic identity for all 24 listed unique DOIs, 29 citing Pleco proposals.
- `resources/aquapedia-pleco-active-55-live-page-citations-20261023.json`: dated public website HTML link parity.
- `tools/audit-aquapedia-pleco-55-live-source-parity-20261023.mjs`: repeatable read-only source check.

**Next release gates:** independent claim-level editorial review, taxon/L-number identity assessment, media rights/permission handling, fresh authenticated Discord thread and message-history readback with duplicate suppression, and a guarded owner-approved single-writer release. Historical counts remain **91 unapproved proposals = 55 active Pleco + 36 archived Cory/Pleco**; no archived operations were attempted. The 128 Guppy trade labels, 7 ambiguous Cory placements and 2 Cory naming holds remain independently excluded.
