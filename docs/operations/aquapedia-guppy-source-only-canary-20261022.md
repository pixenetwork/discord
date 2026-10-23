# Aquapedia Guppypedia source-only canary — October 22, 2026

**Target:** existing public, bot-owned Guppypedia — Genetics and Lineage forum thread `1562195157028184178` in Aquaphoria guild `1519337502379475095`.

**Scope:** Ten base-colour terms from the IKGH 2023 show standard, each linked to its own live Guppypedia working record (GUP-001 through GUP-010). No historical pedigree, genotype, breeder identity, stock authenticity, copied photos, translated article content, or independent scientific verification is asserted.

**Status:** The source-only index is staged with an exact stable marker `[AQUAPEDIA-GUPPY-IHS-BASE:20261022]`. The draft review PR and its other 98 proposals retain their existing review-only state. Do not count this source-only canary as a general release of the 362 unverified cross-category records.

**Operational safety:**
- Manual one-time command, exact `--canary` only. Does not register a scheduler, bot token, webhook or new Discord bot.
- Requires the already running Aquaphoria Discord bot to be initialized and authenticated using its existing environment.
- Acquires the **same exclusive writer lock** used by the existing Medaka/Shrimp/Arowana publisher; never removes a lock that it did not acquire.
- Validates the current live Guppypedia cohort and IKGH source accessibility, all ten destination articles, the existing public forum, thread parent/identity, unlocked and unarchived state, original bot-authored starter, and absence of duplicate links or marker collisions.
- Suppresses image unfurls and mentions; posts no attachments. Checks exact new message content and original bot author with Discord API GET before recording any success.
- Saves one atomic receipt under `data/aquapedia-guppy-base-index-canary-receipt.v1.json`. In a readback/receipt crash scenario, a later invocation adopts the exact existing bot-authored marker instead of reposting it. Mismatching content, owner, thread or receipt fails closed.
- The review branch is **not automatically deployed**; any live execution must be deliberately performed on the authorized Main PC and verified. No manual success should be claimed before a server readback and file receipt.

**Tests:** Source-only message construction, changed source rejection, existing-thread/ownership/visibility gate, duplicate marker adoption, possible collision rejection, oversized recent-history rejection, UTF-16 length safety, and full repository tests.

**Still pending:** Broader PR #60 remains draft and unmerged. The 85 Pleco missing link updates, 10 Cory proposed links, archived destinations and Guppy trade labels still need separate review and release safety gates.
