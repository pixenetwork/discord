# Discord Aquapedia research inbox — review inventory, 2026-10-21

**Disposition:** Source-check and consolidate by research topic, **not** by number of Discord requests. This document is research triage, **not** editorial approval, a breeder-verified pedigree, permission to reuse photos, or an instruction to publish.

The persistent Aquaphoria inbox contains eight `started` historical records for four distinct strain-name requests. Do not change their statuses until original Discord requester intent, any downstream Jarvis/Aquapedia receipts, and any source claims are checked. New failure handling now moves *future* failed jobs to `needs_review`; it does not automatically rewrite these eight old records.

| Exact request name | Count | Existing Aquapedia route | Review priority |
| --- | ---: | --- | --- |
| Mega Rayquaza | 4 | https://aquapedia.app/medakapedia/strains/mega-rayquaza/ (HTTP 200) | Review current entry, don't create four duplicate dossiers |
| Godzilla | 2 | https://aquapedia.app/medakapedia/strains/godzilla/ (HTTP 404 on audit) | Candidate missing entry; provenance confirmation and content intake |
| Neptune | 1 | https://aquapedia.app/medakapedia/strains/neptune/ (HTTP 200) | Verify existing breeder/lineage citations before editing |
| Reris | 1 | https://aquapedia.app/medakapedia/strains/reris/ (HTTP 404 on audit) | Unresolved name: ask original requester for Japanese spelling, photo, and breeder, not a fabricated strain |

## Source evidence to carry into next research pass

**Godzilla / ゴジラ.** Japanese hobby site Medakaya En attributes the strain to 二代目アクアボーイ (Nidaime Aqua Boy) and describes a 墨武 × クロコダイル (Bokubu/Bobu × Crocodile) cross and green external light:
https://www.medakaya-en.com/medaka . A separate Japanese house-name catalog gives 2022 July attribution to the same creator:
https://hinsyu-zukan.satumano-medakayasan.com/2980/ (related strain reference).
Aquaphoria's own sales listing identifies U.S.-bred juveniles from Japanese-imported parental stock, not fish imported as juveniles:
https://www.aquabid.com/listing/1-godzilla-medaka-juvenile-japan-import-bloodline-unsexed/29173 .
These are hobby/seller sources, not the breeder's signed parentage record. **Do not promote the genetic cross to breeder-verified status** without creator confirmation, and don't reuse seller images without a license.

**Neptune / ネプチューン.** The Japanese hobby association JASMA identifies creation in 2023, breeder Medaka-ya Savanna, blue lamé, and parent lines 宮桜 (Miyazakura), ヒミツヘイキ (Himitsu Heiki), サボテン (Saboten):
https://jasma.sc/medaka/nepuchu-n/ .
Treat the suggested arrangement of those three parents and variation/fixation percentages as secondary pending primary breeder documentation; avoid precise Mendelian dominance assertions.

**Mega Rayquaza / メガレックウザ.** SNR Medaka's 2026 import list attributes this named offering to **TOA**:
https://snrmedaka.us/apps/imports/events/2026-summer-medaka-import/ .
This verifies a commercial name and claimed breeder label, **not** an independently substantiated pedigree. Do not automatically substitute parentage claims for standard Rayquaza (レックウザ) for **Mega Rayquaza**.

**Reris.** No authoritative primary source has yet been verified for the exact spelling. Similar-sounding hobby labels such as `Lecris`, `Recris`, or `Recuris` are **not** verified aliases. Keep this item unresolved until the requester identifies breeder/original-language name and provides supporting photographs with provenance.

## Recovery guardrails

- Preserve the eight immutable original research IDs in the existing local database; read-only duplicates are not retries.
- Before assigning work, review claim-level sources and use the **single existing** research/publishing writer.
- Do not auto-send breeder DMs, edit genetics trees, create a public strain page, or post photos from this inventory without evidence and the appropriate permissions.
- Require explicit editorial/public-audience approvals and Discord readback receipts for any later public publication.
- The Jarvis research API URL and authentication remain unconfigured; do not point `JARVIS_RESEARCH_ENDPOINT` at an unrelated portal or unverified local service.
