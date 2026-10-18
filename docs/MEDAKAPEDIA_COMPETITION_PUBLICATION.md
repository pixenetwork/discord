# Governed Medakapedia competition summaries → existing public Discord forum

**State: review-only draft. Do not deploy this branch or post any content without real signed approval and readback.**

## Verified destination

- Existing Aquaphoria guild: `1519337502379475095`.
- Existing public `📚・AQUAPEDIA` category, named forum `🐟・medaka-research` (forum ID `1561189286399705128`).
- This forum was already created and its public access checked in [Discord layout PR #31](https://github.com/pixenetwork/discord/pull/31). The code **reuses** this forum and refuses lookalikes, private categories, or mismatched IDs.
- No additional channels, forums, bots, scheduler, or tokens are authorized or created here.

## Canonical source and source requirements

- Medaka evidence intake: [Aquapedia PR #72](https://github.com/pixenetwork/aquapedia/pull/72), 63 award records in 9 event editions (2022–2026).
- New source-linked public web page: [Aquapedia PR #77](https://github.com/pixenetwork/aquapedia/pull/77), `https://aquapedia.app/medakapedia/competitions/`.
- Before posting, **confirm that URL is public (HTTP 200), the reviewed page shows all 63 organizer-linked entries, and the exact source SHA corresponds to the approved intake**.
- A competition card must have `entityType: "competition"`, `organismGroup: "medaka"`, unique stable `id`, `websiteUrl` exactly that canonical page, and at least one directly cited official HTTPS organizer URL in `sources`.
- Source hosts accepted by this narrowly scoped publisher: `jma-medaka.com`, `ima-medaka.or.jp`, `medakagachibattle.com`, `medakafest.com`, and `en.cipscom.com`. A mere link to Aquapedia is insufficient evidence.
- Use a summary **per event edition**, not a distinct strain page for every result. Distinguish exhibitor, organizer-defined winning class, actual named variety, and creator. A winning exhibitor does not prove strain creation. Preserve unknown strains and disputed lineage as unknown.

## Dispatch contract

Use **only** the existing Jarvis-approved research response and installed Aquaphoria bot. Require all gates to be true:

```json
{
  "status": "completed",
  "discordPublicationApproved": true,
  "publicAudienceApproved": true,
  "publicMedakaResearch": true,
  "cards": []
}
```

The authorization decisions must originate in the governed Jarvis/Athena/reviewer flow; don't synthesize them in the client. `publicShrimpResearch` and `publicArowanaResearch` cannot be simultaneously enabled. Each submitted Medaka card must have `photos: []` until media rights are independently cleared and reviewed. No full-text copyrighted publication reproduction or AI-fabricated fish photos.

The publisher checks existing active and archived threads for duplicate stable IDs, posts or edits only bot-owned records, reads back the actual bot-authored message, and returns the real `threadId` and `messageId` receipt. A failed source, channel permission, readback, or durability check is **blocked/unverified**; never report success or retry blindly.

**No site deployment or Discord write occurred when drafting this change.** There is no automatic timer attached to this branch.
