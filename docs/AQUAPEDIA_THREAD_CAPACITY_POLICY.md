# Aquapedia Discord active-thread capacity policy

**Owner-approved behavior:** the existing public Aquapedia forum publisher checks the **guild-wide active-thread count**, not just the destination forum, before creating threads or reopening archived threads. It refuses new public threads at **950 or more** active guild threads, reserving 50 of Discord's observed 1,000-slot limit for other work.

## What the guard does
- Checks `guild.channels.fetchActiveThreads(false)` immediately before **each** public forum thread creation or unarchive.
- Failure, missing permission, invalid result, or a count of 950+ => **fail closed**, return `discord_thread_capacity_guard`, and preserve any already verified message receipts.
- Updates of existing **active** threads and ordinary messages in existing active discussions remain allowed after identity and source checks.
- It does not archive anything, start a new bot, or change private channels, user posts, staff permissions, or other publisher lanes.
- Avoid duplicate writes by checking all active and archived destination threads before creation; if readback is uncertain, stop for reconciliation.

## Capacity recovery (governed, not bulk deletion)
1. Inventory all active guild threads by forum and owner; do not assume a single forum's active count equals total guild occupancy.
2. Prefer keeping follow-up evidence in already active, source-identified research threads (for example the linked genetics update). This uses no additional active-thread slot.
3. If a new forum thread is essential, archive **only** a small batch of bot-authored, receipt-verified, discussion-inactive Aquapedia threads. Verify message author, public parent, source ID and archive state before each action; never archive unrelated user discussion threads automatically.
4. Archived threads preserve message history and direct links; persist an archive receipt and recheck the guild total after every bounded batch.
5. Reuse the canonical Jarvis/Aquaphoria single-writer lock and persistent receipt store. Never restart a second gateway client, erase an uncertain lock, or retry unverified writes.
6. When concurrency across bots refills capacity, stop; owner approval to publish content does not authorize indiscriminate archiving.

**Incident note:** 2026-10-18: original research 10 + strains 10 + 30 CITES farm histories = 50 independently verified live records. A guild-wide 1,000 active-thread limit interrupted farm publication after 23 posts. Twelve bot-authored receipt-verified farm threads were archived safely to free slots; all 30 eventually verified. A later six-item research digest used one existing active genetics thread without creating a new thread. This policy prevents public Aquapedia publisher loops from refilling the guild to the hard cap.

## Verification
Run `npm run check` and `npm test`. Tests cover the 949/950/1000 boundary, permission errors and existing source-backed forum post readback. Deploy the updated canonical bot only through its established supervised execution path. A GitHub merge does **not** restart or upgrade the live gateway worker.
