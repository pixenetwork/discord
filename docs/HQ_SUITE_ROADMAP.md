# Pixel HQ Elyxir-class Suite — Decomposition Roadmap (issue #2)

This decomposes the epic in `pixenetwork/discord#2` ("Pixel HQ: build full Elyxir-class Discord suite + Jarvis advanced modules") into sequenced, PR-sized sub-tasks with non-overlapping ownership, and does a gap analysis against the code that already exists. It is a planning document only — no runtime code is changed here.

## Important: implementation home / repo-placement decision

The epic describes the **Pixel Network HQ operations platform** (tickets, applications, FiveM/txAdmin integration, gangs, staff ops, and strict **Beverly Hills RP (BHLA) / Blood Diamond RP (BDRP)** multi-tenant isolation).

That platform already exists as **`pixenetwork/90210-github` → `services/pixel-staff-bot`** ("Pixel Network HQ Jarvis Worker"), which already ships a ticket center, Jarvis AI triage, role management, host-ops, BHLA/BDRP-separated logs, and a FiveM log-ingest endpoint.

This repository (`pixenetwork/discord`) is a **different surface**: the single-tenant **Aquaphoria commerce bot** (Shopify catalog/collections/orders, vendor payouts, Aquapedia research, `/gpt`). It is keyed to one guild (`AQUAPHORIA_GUILD_ID`) and one owner.

**Recommendation:** implement the epic in `90210-github/services/pixel-staff-bot` (or a new dedicated `pixel-hq-bot` package), **not** inside the Aquaphoria commerce bot. Building the multi-tenant HQ registry here would be the wrong home and would duplicate/conflict with pixel-staff-bot's existing tenant separation. The Phase-1 design below is written for the pixel-staff-bot home. Owner to confirm placement before Phase-1 code lands.

## Gap analysis (epic module → current status)

Home key: **PSB** = `90210-github/services/pixel-staff-bot`, **AQ** = this Aquaphoria commerce bot, **—** = not yet built.

| Epic module | Status | Where |
| --- | --- | --- |
| Tickets: standard/bug/appeals/staff-reports, claim/unclaim, priority, note, add/remove, transcript, close, ticket-center panel, queue notifications, audit log | Mostly DONE | PSB |
| Tickets: enquiry type, close-request/reopen, rename, reminders, response-time statistics, per-panel config | Partial / missing | PSB |
| Applications (staff/police/EMS/mechanic/custom builder, accept-deny w/ reason, auto-role on approval, review queue + audit) | Missing | — |
| FiveM: live status, player count/queue/restart state, txAdmin restart alerts + countdowns, stats channels | Missing | — |
| FiveM: ban evidence attach/link, ban lookup + appeal linking, sits tracker/leaderboards | Missing (log-ingest seam exists) | PSB (partial) |
| Gang / organization management (create/config, priority, strikes, escalation) | Missing | — |
| Verification / roles / community (verification panels, vanity/sticky/auto roles, sticky messages, keyword responses, welcome, booster, polls, translation, status moderation, mass unban, feedback/voting, branded instances) | Mostly missing (role mgmt exists) | PSB (partial) |
| Tebex / commerce (transaction verification, purchase lookup, donation ticket enrichment, entitlement hooks, fraud flags) | Missing for HQ | — (AQ has separate Shopify commerce) |
| Jarvis: AI ticket agent (read context/screenshots/logs, follow-ups, dedupe, summarize, suggest fix w/ evidence, never claim unverified fix) | Partial / DONE | PSB |
| Jarvis: screenshot/evidence intelligence (image understanding, extract error text, correlate to logs, evidence timeline, permission-gated redaction) | Partial | PSB |
| Jarvis: developer workflow handoff (create/update GitHub issues from confirmed bugs, link issues/PRs, Trello/Slack routing, status sync, resolution summary) | Missing | — |
| Jarvis: incident command mode (scoped incident room, collect logs/screenshots/restart events, timeline, owner, postmortem, archive) | Missing | — |
| Jarvis: staff operations (on/off-duty, shift totals, workload balancing, escalation routing, owner dashboard, knowledge suggestions) | Missing | — |
| Jarvis: knowledge / self-service (FAQ/doc search, command help from live registry, AI answer w/ source links, known-issue detection, public-safe status) | Missing | — |
| Multi-server / product support (isolated server profiles, per-product support queues, license/entitlement checks, HQ branding) | Partial (BHLA/BDRP separation) | PSB |
| Reliability/security/governance: per-module feature flags, per-command RBAC + allowlists, rate limits/abuse protection, durable webhook idempotency, AI usage budgets, audit correlation IDs, health/readiness, structured error-log channel, secret-only config, backup/restore, retention controls, approval gates | Partial (health endpoint, guardrails, secret redaction, human-only bans) | PSB (partial) |

## Phase 1 foundation — design spec (build in PSB first)

Everything else plugs into this. Ship it as one reviewed PR before any feature module. Proposed new modules (new files; do not rewrite existing ticket/AI code):

1. **Feature/module registry** (`src/hq/module-registry.mjs`): register modules with `{ id, description, defaultEnabled }`; per-guild + per-section enable/disable persisted in the store; a single place to gate command/handler registration. DoD: enable/disable path per guild; disabled module registers nothing; unit tests.
2. **Tenant profiles** (`src/hq/tenants.mjs`): canonical profile per server section (BHLA, BDRP, Pixel HQ/office) with its own guild ID(s), role IDs, log-channel map, and data namespace. All state access is namespaced by tenant. DoD: no cross-tenant read/write; test that a BHLA-scoped call cannot read BDRP data.
3. **Permission framework** (`src/hq/rbac.mjs`): canonical **role-ID-based** RBAC (never role-name-only), fail-closed, with per-command permission descriptors and optional explicit allowlists. DoD: tests for renamed-role and duplicate-role scenarios; missing/nil member denies.
4. **Audit + correlation IDs** (`src/hq/audit.mjs`): every privileged action emits an audit event with a correlation ID; secret redaction reused from existing guardrails. DoD: audit event emitted for a gated action; secrets redacted.

Each later module (below) consumes registry + tenants + rbac + audit and owns its own file(s), so multiple modules can be built in parallel without touching each other.

## Sub-task breakdown (PR-sized, sequenced, non-overlapping ownership)

Follows the epic's suggested order. Each task's Definition of Done = implementation + authorization/data-isolation tests + config docs + audit events + enable/disable path + no cross-tenant leakage + restart-safe state where required + rollback path.

1. **Foundation** (above) — `src/hq/module-registry.mjs`, `src/hq/tenants.mjs`, `src/hq/rbac.mjs`, `src/hq/audit.mjs`. Owns: `src/hq/*` core.
2. **Advanced ticket engine deltas** — enquiry type, close-request/reopen, rename, reminders, response-time stats, per-panel config. Owns: existing ticket module + `src/hq/tickets-ext/*`. (Coordinate with the in-flight product/ticket work.)
3. **Applications module** — builder + accept/deny + auto-role + review queue. Owns: `src/hq/applications/*`.
4. **FiveM/txAdmin status + restart alerts + stats channels** — Owns: `src/hq/fivem-status/*`; consumes existing log-ingest.
5. **Ban evidence + appeals linking + staff reports + sits tracker** — Owns: `src/hq/moderation-evidence/*`.
6. **Gang / priority / strike management** — Owns: `src/hq/gangs/*`.
7. **Tebex verification + purchase-enriched support** — Owns: `src/hq/tebex/*`.
8. **Community utilities** (sticky, polls, translation, welcome, booster, vanity/auto roles, keyword responses) — Owns: `src/hq/community/*` (one PR per 1-2 utilities to keep diffs small).
9. **Incident command + engineering handoff + knowledge base** — Owns: `src/hq/incident/*`, `src/hq/devhandoff/*`, `src/hq/knowledge/*`.
10. **Analytics, dashboards, retention, backups, customer-support/licensing mode** — Owns: `src/hq/ops/*`.

## Cross-cutting governance (applies to every task)

- Canonical role IDs only; fail closed; owner/staff/vendor/customer scopes explicit.
- BHLA and BDRP data/permissions/logs never cross; Pixel HQ/office isolated from sensitive server ops.
- No secrets in source/messages/logs; no automatic merge/deploy; destructive/high-impact actions approval-gated.
- No GitHub Actions dependency for validation while Actions is unavailable — use local/static validation.
- Do not clone Elyxir source or branding; features are requirements/reference only, implementation original.

## Recommended next actions (for owner approval)

1. Confirm implementation home (recommended: `90210-github/services/pixel-staff-bot`, or a new `pixel-hq-bot` package). Do not build the HQ suite into the Aquaphoria commerce bot.
2. Approve the Phase-1 foundation design; land it as one PR in the chosen home.
3. Convert the sub-task list into tracked child issues so each module is a single-writer PR lane.
