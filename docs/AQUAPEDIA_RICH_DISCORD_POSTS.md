# Aquapedia Discord — in-channel breeder and strain research posts

## Purpose

Discord is a **content destination, not a directory of links**. Approved research must appear as readable, source-attributed content directly in the existing Aquaphoria Discord, with **real fish and breeder photographs shown inline** where there is a clear reuse right. The master Aquapedia remains the canonical researched source; Discord is a presented copy.

## Destination

- Reuse the live `🔬・BREEDER RESEARCH` category and its **existing named breeder forums** (e.g., `tarumi-medaka`, `mugen-medaka`, `medaka-ya-savanna`) and existing `unknown-breeders` forum. Do not create a competing channel or category; preserve current access permissions.
- One existing **forum per breeder**, with a separate thread for the breeder profile and **one thread per strain** underneath. Full research text and rights-cleared photos appear in each starter message. Subsequent evidence updates can be added to the matching thread.
- A strain with unresolved breeder attribution must **not** be placed under a guessed breeder. The existing `unknown-breeders` forum may be used **only when the approved research card explicitly requests it**; otherwise hold the strain in research verification. A creator's name alone is not sufficient to create a new forum.
- Preserve original Japanese spelling and distinguish originator, later selector, importer, retailer, and marketer.
- `/research` and `/gpt` should use the same posting flow for source-verified, approved structured cards.

## Each breeder profile should contain

**Name (Japanese + romanization);** location/region when public; founder vs business operator; background and documented history; specializations; historical/known strain developments; links or named lines being researched; original photos/portrait/farm photos with permission and credit; primary breeder web/social sources; claim-level confidence and known disputes.

## Each strain dossier should contain

**Japanese/common/English names;** breeder/origin role; documented vs claimed parent lines and breeding dates; physical traits (body shape, lamé, Kagami scale, external light, fin morphology, color, eye traits); grading standards and desirable faults; breeder-reported consistency when evidenced; species-level husbandry plus any *documented* strain-specific exceptions; visual authentication clues; related ancestor/descendant strains; history and rarity if substantiated; availability clearly dated; multiple credited, real specimen photos; links to independent source research and full Aquapedia record.

Never interpret seller names, trades or slogans as verified parentage. Don't describe a descriptive color percentage as an inherited fixation rate. A Kagami label is a mirror-scale trait, not a separate color.

## Image display and rights

**User request:** photos displayed in the message, not only a URL to another page. The worker uses Discord inline embeds for each approved HTTPS specimen image. For each photo, submit `url`, `reuseStatus` (one of `owner_owned`, `licensed`, `permission_granted`, `public_domain`, `cc0`), `credit`, `view`, original page/source and a documented rights receipt in the Aquapedia image registry. An Internet-accessible URL or attribution alone is **not** evidence of permission.

- Never rehost or post protected third-party breeder/publisher photos solely because a page is public.
- No AI-generated/modified fish portraits may substitute for authentic phenotype evidence.
- Aim for 3+ different meaningful photos from at least two sources when rights permit, with top/profile/scale/fin views.
- Initially the renderer permits 3 licensed photos per post; additional views can be subsequent messages only after approval and proper rights metadata.
- If rights are unavailable, post substantiated textual research in the **private** forum and explicitly mark `photos pending rights review`, with the source citation—not a fake stock photo.
- Respect the canonical Aquapedia `docs/image-evidence-standard.md`.

## Jarvis integration contract

`src/research.mjs` asks Jarvis for structured card payloads in addition to versioned Aquapedia research files. The Jarvis backend must explicitly return:

```json
{
  "status": "completed",
  "discordPublicationApproved": true,
  "summary": "Verified research summary",
  "files": [],
  "cards": [
    {
      "id": "source-backed-stable-identifier",
      "entityType": "breeder",
      "name": "Documented breeder name",
      "japaneseName": "原名",
      "summary": "Evidence-qualified breeder summary",
      "description": "Current specializations",
      "history": "Attributed breeder history",
      "lineage": "",
      "breeding": "Approach and achievements if documented",
      "care": "",
      "confidence": "Publisher-reported; breeder independently unverified",
      "sources": ["https://example.org/original-source"],
      "photos": [{
        "url": "https://example.org/permission-cleared-original.jpg",
        "reuseStatus": "permission_granted",
        "credit": "Name of photographer",
        "view": "breeder portrait"
      }]
    },
    {
      "id": "source-backed-strain-identifier",
      "entityType": "strain",
      "name": "Strain",
      "japaneseName": "原名",
      "breederName": "Documented breeder name",
      "description": "Real phenotype notes",
      "lineage": "Breeder-reported parent cross; not DNA verified",
      "history": "Documented line history",
      "breeding": "Evidence-backed grading and variability",
      "care": "Any documented exception to species care",
      "confidence": "Reported, sources verified",
      "sources": ["https://example.org/original-report"],
      "photos": []
    }
  ]
}
```

Example URLs are illustrative **only**. Do not put example photos into the live feed. `discordPublicationApproved` must originate from the existing governed review and appropriate authorization, not a mere user sentence or a research model's self-certification. If false/missing/queued, the worker **does not publish** a card.

## Rollout / backfill safety checklist

1. Do not merge/deploy to a production Discord until the prelaunch policy and the deployment owner allow it. Existing draft prelaunch changes in PR #13 must be accounted for.
2. Confirm the already-connected `jarvis aquaphoria` bot in the existing guild, the currently live `🔬・BREEDER RESEARCH` forum names and permissions, and rights receipts for photos. Read-only Discord REST GET verified bot and guild on 2026-10-13; this did not publish any post.
3. Commission the Jarvis response shape above, with explicit `breederForumName` matching an existing forum name, independent reviewer receipts and correct original source citations. The Discord worker **does not scrape sources or grant image rights** on its own; current live environment has no configured `JARVIS_RESEARCH_ENDPOINT`.
4. Post one verified breeder profile thread and one strain thread **inside that breeder's existing forum**. Verify actual inline images are displayed, credits visible, full research text intact, and no @everyone mention.
5. Reconcile previously researched 35 Aquapedia working entries, 134 SNR catalog import records and 300-strain target; avoid double-posting aliases and avoid treating derivative seller names as new founders.
6. Publish in reviewed batches. Maintain message/thread IDs and receipts for idempotent replay; this first revision does **not yet** implement durable cross-job publishing deduplication.
7. Confirm the live guild message and photo display directly before reporting completion.

**Status:** draft application patch only; not a verified Discord publication. Existing bot is online, healthy on local port `8790` as of 2026-10-13; its live checkout is unrelated and not modified. User-owned or explicitly permissioned original photos and approved research cards are needed for actual multimedia backfill.
