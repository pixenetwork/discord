# Aquaphoria controlled live worker handoff (issue #22)

**Status:** repository and offline gates prepared; **0/22** live Shrimpapedia Discord
receipts verified. This document is the owner-operator checklist for moving the **existing**
Main PC listener onto merged `pixenetwork/discord` main **without** a competing bot, token
leak, or unauthenticated publish path.

## Non-negotiable constraints

- **One writer:** only the governed Aquaphoria worker may hold the Discord session and
  `DATA_DIR` state. Do not start a staging checkout or second Node process on port `8790`.
- **No kill on guesses:** do not terminate an unidentified listener until its checkout,
  credential injection path, and state directory are verified and backed up.
- **Readiness ≠ publication:** `GET /ready` with `initialized=true` is not proof that
  merged `/shrimp-release` or Shrimpapedia publisher code is active on that process.
- **Receipt truth:** issue #22 stays open until **22** bot-owned `threadId` + `messageId`
  pairs are read back and persisted. Simulation IDs from offline harnesses never count.

## Phase A — read-only runtime discovery (Main PC)

1. Identify the process listening on **8790** (PID, parent chain, whether Task Scheduler
   or an interactive shell launched it). **Do not stop it yet.**
2. Determine which checkout and `.env` / `DATA_DIR` that process actually uses (DACL may
   block non-elevated reads — use owner-authorized elevated inspection only).
3. Record the durable state file path and byte size (default `data/aquaphoria-discord.json`
   or `DATA_DIR` override).
4. Confirm **no second** Aquaphoria Node listener exists.

## Phase B — offline exact-main verification (any host)

From a clean checkout pinned to the target Git SHA:

```bash
npm ci --ignore-scripts
npm run check
npm test
node tools/verify-aquaphoria-handoff-preflight.mjs
node tools/verify-shrimp-public-batch.mjs data/shrimp-release/breeders.json data/shrimp-release/competitions.json
node tools/verify-shrimp-batch-e2e.mjs data/shrimp-release/breeders.json data/shrimp-release/competitions.json
```

All commands must pass without Discord credentials. The handoff preflight tool exits **0**
only when required operator tooling exists and the pinned 22-record snapshot checksums load.

## Phase C — supervised worker install (elevated Windows, chosen cutover window)

Prerequisites on the **same** checkout that will run in production:

- `.env` present locally (never committed), matching existing guild/application IDs.
- `npm run check` and `npm test` pass on that exact SHA.

Either:

- **Scheduled Task path (preferred):** `tools/install-aquaphoria-worker-task.ps1` creates
  **Aquaphoria Discord Worker** pointing at `tools/aquaphoria-worker-supervisor.ps1`, or
- **Non-admin logon helper only:** `tools/install-aquaphoria-worker-user-task.ps1` — does
  **not** start a bot immediately (least privilege).

Verify after boot or install:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\verify-aquaphoria-worker.ps1
```

`workerReady` must be **true** (`/ready`: `ok`, `initialized`, not `startupFailed`). Gateway
`/health` alone is insufficient.

## Phase D — controlled cutover from legacy listener

Only when Phases A–C are complete and a state backup exists:

1. **Preview** (no changes):  
   `powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\restart-aquaphoria-worker-admin.ps1`
2. **Apply** (elevated, backup-first): add `-Apply` to the same script. It refuses mismatched
   task names, wrong supervisor paths, missing state, or a surviving foreign listener on 8790.
3. Confirm `/ready` and registered owner commands (including `/shrimp-release` and
   `/research-queue` via `tools/verify-research-queue-command.mjs` when credentials are
   available for a **read-only** Discord API GET).

Do **not** use HostOps V2/V3 for this task unless a separate signed operation is approved;
see `docs/AQUAPHORIA_CONTROLLED_ADMIN_RESTART.md`.

## Phase E — Shrimpapedia publication (owner Discord commands, same running worker)

Prerequisites in the **live** guild:

- Public `📚・AQUAPEDIA` → `🦐・shrimp-research` forum visible to `@everyone` with read history.
- Pinned manifests unchanged: `NOT_POSTED` / approval closed until owner actions at runtime.

Owner sequence (configured `AQUAPHORIA_OWNER_USER_ID` only):

1. `/shrimp-release status` — expect 0 verified receipts initially.
2. `/shrimp-release canary` — one breeder; require verified bot-authored IDs in store.
3. `/shrimp-release finish` — remaining 21 only after canary receipt for the same guild and
   source commit.

See `docs/SHRIMPAPEDIA_PUBLIC_DISCORD_RELEASE.md` for publisher semantics and offline rehearsal.

## Phase F — close issue #22

Close only when:

- All **22** records have durable verified receipts in `researchJobs` for the pinned commit.
- Manifests updated with real Discord IDs (not synthetic harness IDs).
- No duplicate threads were created on the public forum.
- Rollback procedure documented if any receipt is later invalidated.

## Related: issue #20 Migration Hold cleanup

Irreversible deletion of the 31 legacy strain channels in **🔐・MIGRATION HOLD — STRAINS** is
**not** part of the worker handoff. It requires a completed channel inventory in
`data/breeder-migration/migration-hold-receipt-20261012.json`, verified cloud backup parity,
and explicit owner authorization via `planMigrationHoldCleanup()` — see
`docs/BREEDER_MIGRATION_HOLD_CLEANUP.md`.