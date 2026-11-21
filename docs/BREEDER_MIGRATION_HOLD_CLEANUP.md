# Breeder Migration Hold — guarded irreversible cleanup (issue #20)

The 31 legacy strain channels were moved intact into private **🔐・MIGRATION HOLD — STRAINS**.
**No irreversible deletion has been executed.** Independent cloud and local backups were
verified October 12, 2026; see pinned checksums in
`data/breeder-migration/migration-hold-receipt-20261012.json`.

## What remains blocked in source

| Gate | Status |
|------|--------|
| Independent cloud backup SHA-256 / MD5 parity | Verified in receipt manifest |
| 28 forum strain topics (26 full + 2 preview-only large media) | Live; documented in #20 |
| Empty archived Ryurin discussion thread metadata | `data/breeder-migration/archived-thread-metadata-20261012.json` |
| Complete `sourceChannelIds` inventory (31 IDs) | **Empty — intentional fail-closed** |
| Owner explicit irreversible deletion authorization | **Required — not automated** |
| In-repo Discord DELETE execution | **Not implemented** — plan only |

## Offline preflight

```bash
node --test test/breeder-migration-cleanup.test.mjs
```

Or inspect the plan directly from Node:

```javascript
import { planMigrationHoldCleanup } from './src/breeder-migration-cleanup.mjs';
const report = await planMigrationHoldCleanup(); // always dry-run
```

A blocked preflight is **expected** until operators populate all 31 `sourceChannelIds` and
pass `explicitIrreversibleAuthorization: true` with `apply: true`. Even then, this module
returns an **authorized plan only** — production execution remains Jarvis-governed with
authenticated Discord API calls outside this repository.

## Operator steps before any live deletion

1. Re-verify local backup file **206,148,396** bytes, MD5 `25cd0fe8652e90b189e5f8bb144cdf04`.
2. Re-verify remote `alliesdrive:` object matches the same MD5 (read-only `rclone md5sum`).
3. Authenticated guild enumeration: fill `sourceChannelIds` with exactly **31** Migration Hold
   text channels; no duplicates; count must match `movedChannelCount`.
4. Re-run forum topic audit (28 topics, 82 messages, 68 attachments equivalence).
5. Obtain explicit owner written authorization for irreversible deletion.
6. Run destructive tooling only through an approved admin path — **not** by bypassing safety
   interlocks.

## Empty archived thread

The Ryurin archived public thread (`1519384123314274305`) had zero messages and zero
attachments. Metadata is preserved in the archived-thread JSON and echoed in the Ryurin
breeder forum topic audit label. Include this record in the final deletion receipt.