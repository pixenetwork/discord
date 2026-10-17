# Corydoras Research Discord forum publisher

This is an **explicit one-shot REST publishing tool** for the existing Aquaphoria Discord bot, not a second bot, background worker, scheduler or research authority. It was written against Aquapedia's source-backed Corydoras draft PR #20.

## Intended live layout

- Parent category: `🐟・CORYDORAS RESEARCH`
- Forum channel: `🧬・species-and-strains`
- Private access: inherit exactly the existing `🔬・AQUAPEDIA RESEARCH` category's permission overwrites. Explicit @everyone ViewChannel denial is required.
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

- Existing private forum: https://discord.com/channels/1519337502379475095/1560887812910350339
- Pinned master directory index: https://discord.com/channels/1519337502379475095/1560887817217904641
- Third bounded publication run: **80 new** bot-authored and API-readback-verified threads, making **191 forum posts** total (**182 source-directory entries + 8 captive morphs + 1 pinned index**). **346 of the original 528 directory records remain** without individual threads; not every directory record is a distinct valid species or genetic strain.
- Four existing named profiles enriched in place with source-backed identity, original description/recorded localities, care cautions and evidence references: [C. aurofrenatus](https://discord.com/channels/1519337502379475095/1560907001150701610), [O. oharai](https://discord.com/channels/1519337502379475095/1560907008071176274), [O. venezuelanus](https://discord.com/channels/1519337502379475095/1560908309572358188) and [O. schultzei](https://discord.com/channels/1519337502379475095/1560907181308776539). Force-fetched starter messages were compared against intended content and corrections were receipted.
- The historically coded **CW068 is the described 2025 species O. oharai**, based on the original species description: https://www.ni.bio.br/1982-0224-2024-0134/ . The current Eschmeyer Catalog considers *Corydoras venezuelanus* synonymous with *O. aenea*, while hobby references do not all agree. *O. schultzei* status remains uncertain. These records are individually marked with **Taxonomy / Needs review** tags, and distinct from the German breeder-selected black commercial morph.
- Original species description locations and habitat observations **must not be copied into captive breeding water-parameter claims**, and C/CW aliases must not be summed as additional valid species.
- Research crosswalk and claim-level sources appended to the still-draft **Aquapedia PR #20**; the Discord worker remains in draft PR #26. No independent Aegis/Cerberus verification, merge or public Aquapedia website release is asserted.
