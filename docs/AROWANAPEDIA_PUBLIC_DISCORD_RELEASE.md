# Arowanapedia public Discord forum release (2026-10-17)

## Scope and canonical sources
- Existing guild category: `📚・AQUAPEDIA` (reuse; never duplicate).
- Intended public forum: `🐉・arowana-research` (one shared forum, ten distinct threads).
- Canonical source: `pixenetwork/aquapedia` website generator `tools/arowana_public.py`.
- Build exports `site/assets/arowana-forum-cards.json`: seven species/related-lineage records and three research guides. Each links to `https://aquapedia.app/arowanapedia/<slug>/`.
- Two independent documented review gates: `editorialApproved` and `publicAudienceApproved`. Without both, the batch is `review_pending` and cannot publish.
- Forum thread publishing reuses `publishAquapediaCards()`, including duplicate thread detection, bot-authored message-ID readback and per-record receipts. It must not create a second bot process or competing execution loop.
- CITES protection, trade/import law and contested species/locality status are evidence-qualified. Third-party fish photos, champion claims, breeder pedigrees and endangered-collection GPS are not included.

## Offline verification
After building Aquapedia:
```sh
node tools/verify-arowana-public-batch.mjs ../aquapedia/site/assets/arowana-forum-cards.json
npm run check
npm test
```
The verifier uses no bot credentials and makes no Discord API calls.

## Live deployment sequence
1. Confirm exact deployed branch/commit of the existing Discord worker and canonical supervisor, persistent state and rollback. Never restart an unknown running worker or start a duplicate gateway client.
2. Deploy the validated code using the existing Jarvis/supervisor service. The forum provisioner does **not** create or flip a private Aquapedia category to public; if the parent category lacks `@everyone` visibility/read-history permissions, it fails closed.
3. Verify `/ready`, forum type, category parent and public permissions without altering private vendor/staff channels.
4. Independently review the **exact** ten canonical cards and their target website URLs. Record authorization in the governed task/receipt store.
5. Publish one canary via the existing worker's authorized publisher. Read back thread ID, message ID, bot author and record ID and persist receipt before the remaining nine.
6. Publish remaining records only after cross-post duplication checks (active and archived threads). No mass retry without inspecting readback uncertainty.
7. Verify ten thread receipts and ten live article pages, then record completion with exact-head and rollback reference.

**Code status:** prepared for review and test; public Discord posts require separate live receipt confirmation. No claim of actual posting is made by building or merging this repository.
