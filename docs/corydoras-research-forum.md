# Corydoras Research Discord forum publisher

This is an **explicit one-shot REST publishing tool** for the existing Aquaphoria Discord bot, not a second bot, background worker, scheduler or research authority. It was written against Aquapedia's source-backed Corydoras draft PR #20.

## Intended live layout

- Parent category: `📚・AQUAPEDIA` (public)
- Forum channel: `🐟・corydoras-research` (public)
- Public access: forum and parent category have no restrictive permission overwrites; @everyone has ViewChannel. The publisher now refuses to create or re-privatize a missing or moved forum.
- Forum threads: one per selected directory name or documented captive morph, with separate source/status/evidence fields, no unlicensed photos, and Discord mentions disabled.
- One START HERE thread with the exact-source 528-record CSV attachment and links to the canonical Aquapedia dossier.

## Safe operating requirements

1. Use the **existing** Discord bot token from the authorized Main PC deployment; never echo or commit the token, and do not start a second Gateway connection or restart the live bot.
2. Read the pinned Aquapedia research commit `86446265ba4bdbf02a5beb4011d34e8843f545a9` via local Git; fail if the dated inventory is not exactly 528 unique specialist listing IDs.
3. The source directory contains 219 named display labels, 112 C-number and 197 CW-number listings. It is **not** a verified species count or strain count, and has not passed independent Aegis/Cerberus review.
4. Existing thread discovery must traverse active and archived threads before writing. A colliding title without a matching bot-authored research marker fails closed.
5. A post counts as successful only after fetching its starter message and checking the existing bot's author ID plus the stable research marker. Store a local JSONL receipt with the returned thread and message IDs.
6. C/CW records get an explicit taxonomic warning; captive forms never receive invented breeder origins or genetic inheritance. No live site claims, sales, or private source-server URLs.
7. No ongoing schedule is installed by this tool. All further research and upgrades remain under the existing Allie/Athena → Jarvis → Aegis/Cerberus governance.

## Main PC execution

From the existing `pixenetwork/discord` checkout/worktree:

```powershell
node --test test/corydoras-forum-publisher.test.mjs
node --env-file="<existing authorized bot .env path>" tools/corydoras-forum-publisher.mjs --plan --limit=42
node --env-file="<existing authorized bot .env path>" tools/corydoras-forum-publisher.mjs --apply --limit=42
node --env-file="<existing authorized bot .env path>" tools/corydoras-forum-publisher.mjs --apply --pin-guide --limit=0
# For the next review-labelled, unpublished directory batch:
node --env-file="<existing authorized bot .env path>" tools/corydoras-forum-publisher.mjs --plan --next=60
node --env-file="<existing authorized bot .env path>" tools/corydoras-forum-publisher.mjs --apply --next=60
# To revise an already verified, bot-owned post after source crosswalk research:
node --env-file="<existing authorized bot .env path>" tools/corydoras-forum-publisher.mjs --plan --refresh-id=499
node --env-file="<existing authorized bot .env path>" tools/corydoras-forum-publisher.mjs --apply --refresh-id=499
```

The CLI's apply mode requires the user's approval to publish. It automatically reuses already-posted matching threads, so bounded retries are idempotent. **Do not run the apply command concurrently.**

The historical 2026-10-16 index and the research claims remain sourced in [Aquapedia PR #20](https://github.com/pixenetwork/aquapedia/pull/20), not duplicated as a new brain or independent content authority.


## Verified continuation — 2026-10-17

- Existing forum (originally private, moved into public Aquapedia on 2026-10-17): https://discord.com/channels/1519337502379475095/1560887812910350339
- Pinned master directory index: https://discord.com/channels/1519337502379475095/1560887817217904641
- Third bounded publication run: **80 new** bot-authored and API-readback-verified threads, making **191 forum posts** total (**182 source-directory entries + 8 captive morphs + 1 pinned index**). **346 of the original 528 directory records remain** without individual threads; not every directory record is a distinct valid species or genetic strain.
- Four existing named profiles enriched in place with source-backed identity, original description/recorded localities, care cautions and evidence references: [C. aurofrenatus](https://discord.com/channels/1519337502379475095/1560907001150701610), [O. oharai](https://discord.com/channels/1519337502379475095/1560907008071176274), [O. venezuelanus](https://discord.com/channels/1519337502379475095/1560908309572358188) and [O. schultzei](https://discord.com/channels/1519337502379475095/1560907181308776539). Force-fetched starter messages were compared against intended content and corrections were receipted.
- The historically coded **CW068 is the described 2025 species O. oharai**, based on the original species description: https://www.ni.bio.br/1982-0224-2024-0134/ . The current Eschmeyer Catalog considers *Corydoras venezuelanus* synonymous with *O. aenea*, while hobby references do not all agree. *O. schultzei* status remains uncertain. These records are individually marked with **Taxonomy / Needs review** tags, and distinct from the German breeder-selected black commercial morph.
- Original species description locations and habitat observations **must not be copied into captive breeding water-parameter claims**, and C/CW aliases must not be summed as additional valid species.
- Research crosswalk and claim-level sources appended to the still-draft **Aquapedia PR #20**; the Discord worker remains in draft PR #26. No independent Aegis/Cerberus verification, merge or public Aquapedia website release is asserted.

## Public Aquapedia move — 2026-10-17

At the user's explicit request, the **existing** Discord forum `1560887812910350339` was moved from the private `🐟・CORYDORAS RESEARCH` category `1560887811962445854` to the pre-existing **public** `📚・AQUAPEDIA` category `1557338241903099945`, and renamed `🐟・corydoras-research`.

Only the forum's channel was modified. Its four private permission overrides were cleared to match the public Aquapedia category, which has zero permission overwrites and whose guild @everyone role has ViewChannel permission. Its topic now explicitly describes publicly accessible, evidence-labelled research. The private breeder/research sections were not changed. The original forum ID, all topic threads, tags, and pinned master index `1560887817217904641` remain unchanged; Discord REST readback verified parent ID, forum name, zero overwrites and pinned index parent.

**Future publisher rule:** fail closed if the public forum is absent, renamed, placed outside Aquapedia, or given private overrides. Do not recreate the old private category/forum or assume that a public directory record is taxonomically verified.

Migration command (read-only by default):

```powershell
node --env-file="<existing authorized bot .env path>" tools/move-corydoras-forum-public.mjs
# --apply is only needed to reconcile an authorized, known old-state deployment.
node --env-file="<existing authorized bot .env path>" tools/move-corydoras-forum-public.mjs --apply
```

The final live move receipt is written locally under `%LOCALAPPDATA%\PixelNetwork\corydoras-public-forum-move-20261017.json` with IDs and readback status but without credentials.


## Public Aquapedia Corydoras publication — fourth batch, 2026-10-17

- **80 new** source-directory threads published by the existing authorized bot to public AQUAPEDIA / corydoras-research forum (channel ID 1560887812910350339), in one bounded run. Each starter message was fetched and its bot author plus stable AQP-CORY source ID verified. Rate limiting was respected without launching a second writer.
- Live receipts: **271 verified distinct forum posts** = **262 source-directory records**, **8 separately labelled captive morphs** and **1 pinned index**. **266 of 528** dated original directory entries lack individual threads; 528 is not a verified species or strain count. Zero duplicate thread IDs, zero duplicate directory record IDs, zero unverified publication receipts.
- Two previously posted profiles **updated in place** with force-refetched readback and revision receipts:
  - [Corydoras fulleri](https://discord.com/channels/1519337502379475095/1560929267745951785): formally described in 2021 from Peruvian Madre de Dios/Manuripe tributaries, historic C115/C116 codes apply to the same species, and Ian Fuller is the honoree, not thereby a documented line founder. https://pubmed.ncbi.nlm.nih.gov/33837549/ ; https://www.scotcat.com/callichthyidae/c_fulleri.htm
  - [Corydoras isaacisbrueckeri](https://discord.com/channels/1519337502379475095/1560929358926057634): formally described in 2026 from rio Tefé, diagnostic morphology, wild field chemistry NOT aquarium recommendations; CW128/CW207 still unresolved separate codes. https://www.ni.bio.br/1982-0224-2025-0146/ ; https://researcharchive.calacademy.org/research/ichthyology/catalog/fishcatget.asp?spid=78599
- Both profiles retain explicit unknown breeder lineage, genetics, awards and reusable-photo rights. Detailed source additions staged to the still-draft pixenetwork/aquapedia PR #20. Independent review is still required before merging Discord PR #26 or site publication.

## Fifth public Aquapedia batch — 2026-10-17

- Published **80 more** source-directory threads to the existing **public AQUAPEDIA / corydoras-research** forum (channel 1560887812910350339). Single authorized bot, direct starter-message readbacks, no second Gateway instance.
- Verified publication receipts: **351 total posts** = **342 original directory records** + **8 captive morph entries** + **1 pinned master index**. **186 of the initial 528 dated directory records have no individual thread.** Neither the 528 listings nor C/CW code counts are verified distinct species or inherited strains.
- Five original forum starters updated in place, with forced Discord readback and append-only verified revision receipts:
  - [Corydoras negro](https://discord.com/channels/1519337502379475095/1560942031969452054): valid Bolivian wild species, Río Negro in the Santa Cruz Río Blanco system, not the Brazilian Rio Negro. Source: https://researcharchive.calacademy.org/research/ichthyology/catalog/fishcatget.asp?family=Callichthyidae&tbl=species
  - [Corydoras septentrionalis](https://discord.com/channels/1519337502379475095/1560944552917999669): Gosline 1940, Río Piña, Guarapiché system, Monagas, Venezuela; no inferred captive founder. Source: https://researcharchive.calacademy.org/research/ichthyology/catalog/fishcatget.asp?genus=Corydoras&tbl=species
  - [Osteogasters sp. CW026](https://discord.com/channels/1519337502379475095/1560897526327021623): raw genus spelling error flagged as unverified
  - [Hoplisomas sp. C073](https://discord.com/channels/1519337502379475095/1560943337844768839): raw genus spelling error flagged as unverified
  - [Gastrdermus sp. CW131](https://discord.com/channels/1519337502379475095/1560943343918125113): raw genus spelling error flagged as unverified
- Source-record IDs and direct specialist URLs remain unchanged; no new genus, valid biological species, genetic strain, breeder method or photo rights are inferred from typos. Original specialists: https://www.corydorasworld.com/lineages/gastrodermus ; https://www.corydorasworld.com/lineages/hoplisoma
- Additional primary/catalog taxonomic leads recorded as a comment on still-draft Aquapedia PR #20. No independent Aegis/Cerberus signoff, merge or Aquapedia site promotion is asserted; Discord publisher work remains in draft PR #26.

## Sixth public Aquapedia batch — 2026-10-17

- Added **80** more specialist source-directory threads using the existing authorized Discord bot in public AQUAPEDIA / corydoras-research (forum ID 1560887812910350339). Every new starter was retrieved and its bot author and original source ID marker checked.
- Final verified receipt ledger: **431 unique posts**, consisting of **422 original source-directory listings**, **8 distinct labelled captive-morph entries**, and the **pinned master index**. **106 of the 528 dated directory records still have no individual forum thread**. These are directory records, **not a validated count of distinct biological species or genetic strains**.
- **Zero duplicated thread IDs**, **zero duplicated source-record IDs**, **zero unverified publication receipts**. Discord rate limits were respected within the same one-shot writer.
- Updated the original existing messages in place, with forced API readback: [Hoplisoma granti](https://discord.com/channels/1519337502379475095/1560954721244553332) (historic C020 vs true C. arcuatus / CW036); [Hoplisoma eversi](https://discord.com/channels/1519337502379475095/1560953513222078539) (Rio Araguaia type locality); [Corydoras serratus](https://discord.com/channels/1519337502379475095/1560953366551466006) (Rio Poranga, upper Rio Negro). Scholarly references: https://www.fishbase.se/biblio/BiblioSummary.php?id=137973&speccode=71311&syncode=175776 ; https://researcharchive.calacademy.org/research/ichthyology/catalog/fishcatget.asp?spid=74221 ; https://www.gbif.org/species/2342783 .
- Three source-directory spelling anomalies read back without duplicating the initial entries: Hoplisomas CW079 (directory 574), Hoplisomas C084 (167) and Hoplisoms CW088 (584). The latter needed an in-place content correction; the first two already had valid warnings and received reconciliation receipts.
- More detailed evidence added to the still-draft Aquapedia PR #20. No independent signoff, photo permission, website merge or breeder/genotype assertion is inferred from source directory records.

## Complete initial public directory publication — 2026-10-17

- The final source-directory pass posted **80 + 26** more new entries, each with fetched bot-owned Discord starter and stable source-marker readback, in the existing public Aquapedia Corydoras forum.
- Final append-only receipt audit: **537 verified public forum posts** = **528 of 528 original specialist-directory records**, **8 separately identified captive morph/selected-line entries**, and **1 pinned master index**. **0 unposted initial directory records**, **0 duplicated source-record IDs**, **0 duplicate thread IDs**, **0 unverified publication receipts**. Revisions: **27 verified in-place update/reconciliation receipts**.
- This completes the **initial directory seeding**, NOT a validated count of distinct scientifically accepted species, natural populations, independently inherited captive lines, or completed deep-breeding dossiers. The source directory remains research material requiring field-by-field review.
- Original 2022 study: https://www.ni.bio.br/1982-0224-2022-0070/ . Historical source IDs **CW146** = described **Hoplisoma thanatos**, **CW172** = described **Hoplisoma psamathos**, **CW173** = described **Hoplisoma hypnos**; these codes are historical aliases, not distinct additional named species. **CW111** remains a separately unresolved Zebrina/Vulcan form; the 2022 expedition failed to find unmistakable matching fish, so do not infer synonymy.
- Updated in place with live forced starter-message readback: [H. hypnos](https://discord.com/channels/1519337502379475095/1560963648636190843), [H. psamathos](https://discord.com/channels/1519337502379475095/1560965043489873923), [H. thanatos](https://discord.com/channels/1519337502379475095/1560966709211308154), [historical CW173](https://discord.com/channels/1519337502379475095/1560965046123757639), [unresolved CW111](https://discord.com/channels/1519337502379475095/1560963696098807879), [H. knaacki](https://discord.com/channels/1519337502379475095/1560963692877582433), and [H. parallelum](https://discord.com/channels/1519337502379475095/1560964959352131666). Original taxonomic genus changes, type drainage, code history and breeder-unknown fields are explicit.
- A pinned-directory row labelled `Hoplisoma sp. CW39` was mistakenly classified by the source as 'Named taxon'. The publisher now uses its *name/number syntax* to display and tag it as a provisional **CW-number**, not a formal described species. Raw source ID and label remain intact.
- Other likely genus spelling errors now marked with provenance-aware warnings: Brochiss C152, Holisoma CW142, together with prior Osteogasters, Hoplisomas, Hoplisoms, Gastrdermus anomalies. Do not invent taxonomic names or breed pedigrees from raw label spellings.
- Next actual research stage: specimen/synonym crosswalk, captive line breeder interviews, breeding methods and water variables with date-specific evidence, health/diet/compatibility protocols, show/competition results with winners, and photo licence/credit audit. Both Aquapedia research PR #20 and Discord publisher PR #26 remain drafts awaiting independent governance review. No public website promotion or images republished in this run.
