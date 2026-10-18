# Aquaphoria / Aquapedia Discord — Council Execution (2026-10-17)

## Scope and live evidence
- Existing server and bot only; no new scheduler, publisher authority, memory system, or Discord guild.
- Source baseline `pixenetwork/discord` main `c47227cd0610f8a2fff85500abc4e9a8582f7b4f`.
- Live pre-change inventory saved on authorized Main PC under `data/discord-council-prechange-20261017.json`. Contains 14 categories, 76 text channels, 20 forums, and 889 active threads at audit time.
- Public Aquapedia landing channel ID `1557338242548764692` originally contained no messages.
- Published the pinned directory via the existing Aquaphoria bot; read-back verified message ID `1561189276060884994`. Receipt in the live worker `data/discord-council-index-receipt-20261017.json`.
- Public directory source resolution fails closed for missing, private, or ambiguous channels, and the publisher is idempotent for the bot-owned index marker.

## Historical archive controls
- The existing `📚・AQUAPHORIA LIBRARY` category has no effective @everyone view deny; the older channels have heterogeneous per-channel overwrites.
- The `libraryOnly: true` code flag does **not** have a documented mapping to a Discord viewer role. Existing role inventory contains Aquaphoria Staff, Verified Vendor, Member, and the bot role, but no explicit library-access role. Older source calls this a *read-only historical reference*, which does **not** conclusively mean it should be made private.
- **No blanket view-deny or staff-only policy was applied.** Enforcing an unverified access audience could remove intended public historical/lineage access and lock members out. Resolve authorization policy before any change and test per-child inheritance first.
- The 31-channel private Migration Hold is backed up and indexed in `data/discord-council-legacy-alias-inventory-20261017.json`. It has two confirmed normalized naming collisions: `mermaid` ×2 and `mega-rayquaza`/`megarayquaza`. These are not evidence that the contents are duplicates. No channel was renamed, moved, merged, or deleted.

## Safe next work
1. Document precise library readers/writers and whether public historical records are intentional; test effective viewer roles before/after any guarded policy change.
2. Build additional public per-species forum indexes from validated public posts while preserving source citations, thread IDs, and image permissions.
3. Reconcile exact archival collisions using breeder-original/lineage evidence; maintain channel aliases and links.
4. Use existing Jarvis governed dispatch and independent Aegis/Cerberus verification for further runtime changes.

## Verification contract
- Run focused tests and complete `npm test` and `npm run check` on the exact candidate head.
- Capture live message author, ID, exact content, pinned status, and target public links after publication.
- Keep independent model reviews as advisory only; neither votes nor test passes grant execution authority.
