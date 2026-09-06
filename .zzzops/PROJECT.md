# Project success charter

**Status:** complete
**Last reviewed:** 2026-09-06

## Overall goal
- Outcome: Maintain the dedicated Pixel Network Discord worker repository with bounded permissions, token safety, and auditable automation behavior.
- Primary beneficiaries: Pixel Network community operators, Discord automation maintainers
- Why it matters: Durable project policy keeps autonomous work reviewable, resumable, and bounded by repository-specific evidence rather than chat/session state.
- Time horizon: Ongoing repository operation; review when project scope, canonical ownership, execution authority, or release governance materially changes.

## Success metrics
| KPI | Why it matters | Baseline | Target / threshold | Evidence source | Review cadence |
| --- | --- | --- | --- | --- | --- |
| Exact-head change integrity | Stale evidence must not authorize moved source. | Quantitative historical rate not yet measured. | 100% of promoted source changes bind review/verification to the exact candidate head and current target state. | PR metadata, local verification receipts, exact-head comparison records. | Per promotion. |
| Verified completion integrity | Process start or agent prose is not completion proof. | Quantitative historical coverage not yet measured. | 100% of completed substantial goals carry artifact-appropriate observable evidence. | ZzzOps goal records, local test/runtime outputs, review receipts. | Per goal completion. |

## Project acceptance criteria
- [x] Substantial agent work is represented by a durable ZzzOps goal when the Tracked threshold applies.
- [x] Each coherent source/resource surface has one writer at a time; parallel lanes are non-overlapping.
- [x] Exact candidate head and current target are re-fetched before promotion; stale review does not authorize moved heads.
- [x] GitHub Actions/runners are not Jarvis execution, validation, deployment, recovery, HostOps, or reviewer-quorum authority.
- [x] Completed goals require artifact-appropriate observable evidence.

## Value rubric
- `critical`: required for project acceptance, safety, or a binding deadline.
- `high`: materially moves a priority KPI or unlocks critical/high-value work.
- `medium`: useful measurable contribution with limited leverage.
- `low`: weak, speculative, cosmetic, or currently unmeasured contribution.

When KPIs conflict, prefer: Safety and authorization first; correctness and evidence integrity second; project outcome and throughput third; convenience and cost last.

## Constraints and non-goals
### Constraints
- Never expose Discord tokens or secrets.
- Permission, role, destructive moderation, and external-write changes require risk-proportionate review.
- Preserve one-writer ownership, exact-head validation, approved local/direct validation, and fail-closed handling.

### Non-goals
- Creating duplicate or invented work merely to keep agents busy.
- Bypassing repository review, merge, release, credential, or production authority.

### Unacceptable tradeoffs
- Higher throughput in exchange for stale evidence, conflicting writers, weaker authorization, or false completion claims.
- Using GitHub Actions/runners as a convenience substitute for approved local/direct validation.

## Assumptions and open questions
- None recorded at initialization; add evidence-backed changes with history.

## Operating policy

- `[policy:backend]` **Canonical goal backend**: github_issues (customized from a ZzzOps default)
- `[policy:git_review_release]` **Git, review, and release**: Follow repository rules: one draft PR per source-changing writer lane; preserve exact-head discipline; re-fetch candidate head and current main before promotion; use human_at_exhaustion review without bypassing required PR, merge, or release authority. (customized from a ZzzOps default)
- `[policy:execution_continuation]` **Execution and work continuation**: Continue across actionable goals under reviewed dependency and resource policy, and incorporate newly captured goals at the next safe checkpoint. (customized from a ZzzOps default)
- `[policy:verification_testing]` **Verification and testing**: Require artifact-appropriate observable evidence on the exact candidate head using approved local/direct execution; GitHub Actions results are provenance only and never authoritative Jarvis validation. (customized from a ZzzOps default)
- `[policy:code_quality]` **Code-quality and refactoring boundaries**: Preserve behavior unless a goal explicitly authorizes a behavior change. (customized from a ZzzOps default)
- `[policy:dependencies_tooling]` **Dependencies, tooling, and generated artifacts**: Use project-native tooling; do not hand-edit generated or dependency-owned files. (customized from a ZzzOps default)
- `[policy:security_privacy_compliance]` **Security, privacy, secrets, and compliance**: Repository policy may tighten but never weaken ZzzOps safety and authority boundaries. (customized from a ZzzOps default)
- `[policy:documentation_style]` **Documentation and style**: Follow evidenced repository documentation, style, and user-communication conventions. (customized from a ZzzOps default)
- `[policy:deployment_resources]` **Deployment, environment, and resources**: Do not deploy without explicit authority; authoritative execution and validation use approved local/direct paths, never GitHub Actions runners. (customized from a ZzzOps default)
- `[policy:engineering_rigor]` **Engineering rigor**: structured (customized from a ZzzOps default)
- `[policy:workflow_adherence]` **ZzzOps workflow adherence**: tracked (customized from a ZzzOps default)
- `[policy:automated_design]` **Automated design authority**: enabled (customized from a ZzzOps default)
- `[policy:autonomy_approval_parallelism]` **Autonomy, approvals, and parallelism**: Interview thoroughly during goal capture; execute unattended within reviewed authority; allow multiple writer lanes only when their file/resource scopes are explicitly non-overlapping; keep one writer per coherent surface; use up to three size-aware worktree workers. (customized from a ZzzOps default)

Detailed rationale and review history: [PROJECT_AUDIT.md](PROJECT_AUDIT.md). Canonical policy state: [POLICY.json](POLICY.json).
