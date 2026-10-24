# AquaPedia article publisher — fail-closed repair handoff (draft)

**Status:** Review-only. No production deployment, Discord publication, or service restart is authorized by this document.

**Issue:** [Discord #63](https://github.com/pixenetwork/discord/issues/63). **Candidate:** [Draft PR #64](https://github.com/pixenetwork/discord/pull/64).

## Authority and observed state

The existing hourly All Websites Content and Commerce lane is the sole governed publisher. Jarvis owns its one-writer release/lease. Aegis and Cerberus must issue actual independent, current-head review receipts; comments by the repository owner on their issues are not agent acknowledgments.

The Main PC live worktree `C:\Users\duy\.jarvis-worktrees\discord-d2-recovery-20261002` contains **untracked** operational scripts, so an ordinary `git pull` is **not** an approved deployment process. The original operational `tools/aquapedia-article-content-watch-20261015.mjs` SHA-256 was `391E1658FC20AD501558D81ABE8A763422AD5870FDBCE6946357B1E6451666E6`. Keep that exact file and its provenance available for rollback; do not overwrite live files merely because this PR exists.

The incident's five preexisting article cards were confirmed as bot-owned, linked to their original site pages, and **not edited**; the later complete article `--check` returned `scanned=526, changes=0`. Do not force a cosmetic repost or reset checkpoint hashes just to produce an edit timestamp.

## Security correction

When `state.receipts[key]` exists, require a message ID matching the intended channel. Retrieve that exact message and validate its author and article marker. Any missing metadata, destination mismatch, GET 403/404/429/5xx/timeout, or invalid readback must **throw before** the recent-message scan, POST, PATCH, or checkpoint update.

A verified 404 on an existing receipt is **not** automatic approval to create a replacement post. A human-approved, documented missing-post reconciliation is a separate procedure. New articles with no receipt use the existing restricted-channel posting flow.

## Predeployment gates

1. Verify exact GitHub PR head, readable diff, no credentials/private checkpoint committed, and no source change since final review.
2. Run `npm ci --ignore-scripts --no-audit --no-fund`, `npm run check`, and `npm test` in an isolated working tree. Confirm regression tests for GET failures, malformed historic receipts, marker/author mismatch, and checkpoint non-advancement.
3. Obtain real independent Aegis and Cerberus executable findings and Doctor/Jarvis ownership/rollback approval. An opened issue or owner-authored comment is not a substitute.
4. Reconfirm production bot health, public source availability and complete article scan, existing state and receipt integrity, private channel permissions, and an exclusive writer lease. Never interfere with live jobs or Main PC foreground work.

## Controlled release and acceptance (only after approval)

1. Use the **existing** Jarvis-governed release lane. Preserve verified backups of the exact live script and its two local helpers, and record original/source SHA-256 and file paths. Preserve `.env` and checkpoint JSON in place; do not copy private values to GitHub.
2. Install only the approved script/helpers under an authenticated, fenced, exclusive publisher writer, without spawning a second scheduler or modifying Discord channel structure.
3. From the normal runtime directory, first run the authorized **read-only** `node --env-file=.env tools/aquapedia-article-content-watch-20261015.mjs --check`. If `changes=0`, do **not** run `--apply` or manufacture a revision.
4. For a later genuinely changed page, use one bounded `--apply` **only** after safety gates pass. Verify Discord message ID/author/marker/channel and source link via independent REST GET, then rerun complete `--check` to confirm no pending changes. Existing receipt IDs must be reused.
5. If anything fails, stop further writes, retain diagnostic receipts and current durable state, and restore the exact preserved original script/helpers through the same authorized rollback lane. **Do not** reset, bootstrap, delete, or hand-edit checkpoints or writer locks.

## Remaining limitations

The draft's tests use mocked Discord REST calls and extracted production guarded blocks; they do **not** establish actual Discord end-to-end release readiness. Real bot security ACL, state persistence under process crash and cross-run one-writer fencing require separate independent verification. The PR remains unmerged and the live publisher remains unchanged.

## First-write intent and uncertain Discord outcomes

When an article has **no prior receipt**, the reviewed publisher writes a durable `status: pending` entry (with the chosen channel and a message ID only if an existing bot-owned post was already located) **before** any PATCH/POST. The record is replaced with the verified complete receipt only after independent Discord GET validates the persisted card. A POST timeout, failed readback, crash, or failed checkpoint write therefore does **not** authorize another POST: the next run encounters the pending receipt and fails closed rather than duplicating the message.

A `pending` receipt is an **operator-review condition**, not publication success. Jarvis must inspect actual channel history and bot-owned marker/author/source URL through authenticated **read-only** Discord requests, reconcile whether the message exists, preserve the original IDs, and document a bounded recovery approval before any state repair. Never bootstrap, delete the pending record, truncate channel history, or force a replacement POST to clear the queue. Missing old message IDs or cross-channel receipts must remain blocked.

## Automated review triage note

The source-level private-channel preflight is now supplemented by validation of the **actual selected** breeder forum and shrimp destination. Current read-only Discord permissions audit found 15 breeder forums with no direct public `@everyone` ViewChannel overrides and the research-results destination private, but this is not a substitute for current role/ACL verification at release.

`meaningful(main)` strips HTML elements only to calculate a stable content **digest**, not as an HTML sanitizer or rendered/user-executable output. CodeQL HTML-filter findings need independent context review; changing this digest normalization in a small security patch may cause **all existing article digests** to change, creating a mass queue. Do not adjust the hashing algorithm or dismiss active security alerts without a documented migration and qualified review.
