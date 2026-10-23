# Guppypedia remaining IKGH show-standard indexes — source-only release

This change adds three manually invoked, idempotent index messages to **existing** Aquaphoria public Discord threads, using the same authenticated bot and writer lock as the first successful GUP-001–010 source-only canary.

- `cover-one`: GUP-011–029, 19 show-standard color and pattern labels → existing Genetics and Lineage thread.
- `cover-two`: GUP-030–035, 6 show-standard color and pattern labels → same existing Genetics and Lineage thread.
- `tail`: GUP-036–048, 13 IKGH tail forms → existing Show Tail Standards thread.

Every entry is an individual hyperlink to a public Aquapedia working record. Content cites the IKGH 2023 standard and states that **no pedigree, genotype, original breeder identity, or authenticated stock is verified**. No photos, attachments or third-party source material are rehosted.

Each manual topic command:

1. Obtains the exclusive shared writer lock and checks the existing managed bot health and environment.
2. Revalidates the full current 176-entry Guppypedia source cohort and IKGH label identities, primary source reachability, and each article containing its source.
3. Checks the original bot-owned starter, public forum parent, unarchived/unlocked state, all existing thread messages, marker uniqueness and absence of duplicate record links.
4. Sends **at most one** Discord message, without mentions or unfurls, and verifies exact message content and bot author through authenticated Discord readback.
5. Writes a topic-specific atomic receipt only after successful verification; subsequent invocations adopt the exact existing message instead of reposting it.

No new channels, threads, alternate bots, scheduled jobs or changes to the existing publisher runtime. No public release of the 128 Guppy trade labels, Pleco or Corydoras draft claims is implied.

Draft PR #60 remains a governed editorial research review. The source-only index release is narrow and doesn't approve the 95 other Corydoras/Pleco proposals.
