# ZzzOps project policy audit

Status: complete. Reviewer: duy. Revision: 2.

## Evidence and decisions

- [x] `[policy:backend]` **Canonical goal backend** (applicable)
  - Decision: github_issues
  - Rationale: replace with capability evidence and repository identity
  - Sources: E-004: ZzzOps 2.1.0 init inspect — GitHub repository pixenetwork/discord is usable with Issues enabled; initialization head is 40c9b8a4113680d17ac9f00ffc235adcfa63ec0d.
  - Confidence/default: medium; ZzzOps GitHub-only authority → changed
  - Provenance: customized from a ZzzOps default
  - Settings: `{"authority": "github_issues", "capability_evidence": "ZzzOps init inspect verified pixenetwork/discord is usable with GitHub Issues enabled.", "fallback": "forbidden", "repository_identity": "pixenetwork/discord", "tradeoffs": {"github_issues": "shared native issue queue requiring GitHub access"}}`
  - Exceptions: none
  - Unresolved: none
- [x] `[policy:git_review_release]` **Git, review, and release** (applicable)
  - Decision: Follow repository rules: one draft PR per source-changing writer lane; preserve exact-head discipline; re-fetch candidate head and current main before promotion; use human_at_exhaustion review without bypassing required PR, merge, or release authority.
  - Rationale: Preserves portfolio exact-head, one-writer, review, and guarded-promotion governance.
  - Sources: E-001: repository README/manifest/tree inspection — Maintain the dedicated Pixel Network Discord worker repository with bounded permissions, token safety, and auditable automation behavior.; E-002: repository inspection — Clean initialization snapshot; exact head is 40c9b8a4113680d17ac9f00ffc235adcfa63ec0d; no existing .zzzops/POLICY.json was present.; E-003: Athena portfolio ZzzOps policy review approved by user — Use Structured engineering rigor, Tracked ZzzOps adherence, human_at_exhaustion review timing, one-writer ownership, exact-head discipline, approved local/direct validation, and fail-closed safety boundaries.; E-004: ZzzOps 2.1.0 init inspect — GitHub repository pixenetwork/discord is usable with Issues enabled; initialization head is 40c9b8a4113680d17ac9f00ffc235adcfa63ec0d.
  - Confidence/default: medium; ZzzOps exhaustion-time review fallback → changed
  - Provenance: customized from a ZzzOps default
  - Settings: `{"branch_base": "nearest_authorized_trunk", "child_target": "nearest_parent_branch", "commit_style": "conventional", "commit_unit": "verified_subgoal", "conversational_approval": "never_for_goal_progress", "dependency_base": "dependency_branch", "execution_branch": "per_goal", "merge_after_approval": "when_authorized", "multiple_dependency_base": "reviewed_base_containing_all", "parent_pseudo_trunk": true, "pr_approval": "required_when_repository_requires_pr", "pull_request_unit": "per_goal", "read_only_dependency_investigation": "allowed_before_completion", "review_gate": "human_at_exhaustion", "review_pending_dependency": "stack_from_reviewed_checkpoint", "review_state_reads_per_checkpoint": 1, "shared_pull_request": "explicit_reviewed_override"}`
  - Exceptions: none
  - Unresolved: none
- [x] `[policy:execution_continuation]` **Execution and work continuation** (applicable)
  - Decision: Continue across actionable goals under reviewed dependency and resource policy, and incorporate newly captured goals at the next safe checkpoint.
  - Rationale: reduces babysitting without forcing sequential work when bounded parallelism is safe
  - Sources: E-001: repository README/manifest/tree inspection — Maintain the dedicated Pixel Network Discord worker repository with bounded permissions, token safety, and auditable automation behavior.; E-002: repository inspection — Clean initialization snapshot; exact head is 40c9b8a4113680d17ac9f00ffc235adcfa63ec0d; no existing .zzzops/POLICY.json was present.; E-003: Athena portfolio ZzzOps policy review approved by user — Use Structured engineering rigor, Tracked ZzzOps adherence, human_at_exhaustion review timing, one-writer ownership, exact-head discipline, approved local/direct validation, and fail-closed safety boundaries.; E-004: ZzzOps 2.1.0 init inspect — GitHub repository pixenetwork/discord is usable with Issues enabled; initialization head is 40c9b8a4113680d17ac9f00ffc235adcfa63ec0d.
  - Confidence/default: medium; ZzzOps first-release fallback → changed
  - Provenance: customized from a ZzzOps default
  - Settings: `{"after_additive_capture": "resume_once_and_reprioritize", "continue_while_actionable": true, "cross_task": "require_explicit_harness_signal", "execute_intent": "same_task_until_superseded", "exhausted_handoff_retains_intent": true, "human_unblock_watch": {"enabled": false, "max_blockers": 1, "max_seconds": 180, "notify_once": true, "poll_seconds": 30, "trigger": "disabled_for_unattended_execution"}, "max_easy_wins": 2, "new_goal_checkpoint": "next_safe_checkpoint", "stop_reasons_clear_intent": ["user_stop", "pause", "replacement_request", "capture_only", "required_authority", "blocking_boundary"], "triage_new_first": true}`
  - Exceptions: none
  - Unresolved: none
- [x] `[policy:verification_testing]` **Verification and testing** (applicable)
  - Decision: Require artifact-appropriate observable evidence on the exact candidate head using approved local/direct execution; GitHub Actions results are provenance only and never authoritative Jarvis validation.
  - Rationale: Requires falsifiable evidence without GitHub Actions execution authority.
  - Sources: E-001: repository README/manifest/tree inspection — Maintain the dedicated Pixel Network Discord worker repository with bounded permissions, token safety, and auditable automation behavior.; E-002: repository inspection — Clean initialization snapshot; exact head is 40c9b8a4113680d17ac9f00ffc235adcfa63ec0d; no existing .zzzops/POLICY.json was present.; E-003: Athena portfolio ZzzOps policy review approved by user — Use Structured engineering rigor, Tracked ZzzOps adherence, human_at_exhaustion review timing, one-writer ownership, exact-head discipline, approved local/direct validation, and fail-closed safety boundaries.; E-004: ZzzOps 2.1.0 init inspect — GitHub repository pixenetwork/discord is usable with Issues enabled; initialization head is 40c9b8a4113680d17ac9f00ffc235adcfa63ec0d.
  - Confidence/default: high; ZzzOps observable-work fallback → changed
  - Provenance: customized from a ZzzOps default
  - Settings: `{"artifact_verification": {"documentation": "inspect_artifact_no_feature_test", "product_runtime": "risk_proportionate_behavioral_probe", "test_cases": "run_changed_tests_no_recursive_meta_test", "test_harness": "focused_behavioral_regression"}, "ci_deduplication": {"failure": "inspect_logs_and_reprobe", "local_probe": "smallest_unique_falsifiable_signal", "required_ci": "authoritative_validation_uses_approved_local_execution_on_exact_head; GitHub status is provenance only", "skip_broad_local_when": "same_command_required_ci", "unavailable": "durable_blocker"}, "mode": "chunk_probe", "test_bug": "capture_and_ask", "widen": "as_relevant"}`
  - Exceptions: none
  - Unresolved: none
- [x] `[policy:code_quality]` **Code-quality and refactoring boundaries** (applicable)
  - Decision: Preserve behavior unless a goal explicitly authorizes a behavior change.
  - Rationale: separates cleanup from product decisions
  - Sources: E-001: repository README/manifest/tree inspection — Maintain the dedicated Pixel Network Discord worker repository with bounded permissions, token safety, and auditable automation behavior.; E-002: repository inspection — Clean initialization snapshot; exact head is 40c9b8a4113680d17ac9f00ffc235adcfa63ec0d; no existing .zzzops/POLICY.json was present.; E-003: Athena portfolio ZzzOps policy review approved by user — Use Structured engineering rigor, Tracked ZzzOps adherence, human_at_exhaustion review timing, one-writer ownership, exact-head discipline, approved local/direct validation, and fail-closed safety boundaries.; E-004: ZzzOps 2.1.0 init inspect — GitHub repository pixenetwork/discord is usable with Issues enabled; initialization head is 40c9b8a4113680d17ac9f00ffc235adcfa63ec0d.
  - Confidence/default: medium; ZzzOps conservative fallback → changed
  - Provenance: customized from a ZzzOps default
  - Settings: `{"completion_self_review": "required_before_review_or_done", "dead_code": "remove_only_if_evidenced_and_in_scope", "dynamic_generated_vendor": "retain_without_proof", "non_behavioral_only_without_feature_goal": true, "record_clean_review": true, "reverify_after_changes": true, "review_scope": "goal_diff_tests_and_relevant_surroundings"}`
  - Exceptions: none
  - Unresolved: none
- [x] `[policy:dependencies_tooling]` **Dependencies, tooling, and generated artifacts** (applicable)
  - Decision: Use project-native tooling; do not hand-edit generated or dependency-owned files.
  - Rationale: replace with repository-specific commands and ownership evidence
  - Sources: E-001: repository README/manifest/tree inspection — Maintain the dedicated Pixel Network Discord worker repository with bounded permissions, token safety, and auditable automation behavior.; E-002: repository inspection — Clean initialization snapshot; exact head is 40c9b8a4113680d17ac9f00ffc235adcfa63ec0d; no existing .zzzops/POLICY.json was present.; E-003: Athena portfolio ZzzOps policy review approved by user — Use Structured engineering rigor, Tracked ZzzOps adherence, human_at_exhaustion review timing, one-writer ownership, exact-head discipline, approved local/direct validation, and fail-closed safety boundaries.; E-004: ZzzOps 2.1.0 init inspect — GitHub repository pixenetwork/discord is usable with Issues enabled; initialization head is 40c9b8a4113680d17ac9f00ffc235adcfa63ec0d.
  - Confidence/default: medium; ZzzOps conservative fallback → changed
  - Provenance: customized from a ZzzOps default
  - Settings: `{"dependency_changes": "explicit_scope", "generated_files": "source_or_generator_only", "tooling": "project_native"}`
  - Exceptions: none
  - Unresolved: none
- [x] `[policy:security_privacy_compliance]` **Security, privacy, secrets, and compliance** (applicable)
  - Decision: Repository policy may tighten but never weaken ZzzOps safety and authority boundaries.
  - Rationale: record applicable project constraints without making safety optional
  - Sources: E-001: repository README/manifest/tree inspection — Maintain the dedicated Pixel Network Discord worker repository with bounded permissions, token safety, and auditable automation behavior.; E-002: repository inspection — Clean initialization snapshot; exact head is 40c9b8a4113680d17ac9f00ffc235adcfa63ec0d; no existing .zzzops/POLICY.json was present.; E-003: Athena portfolio ZzzOps policy review approved by user — Use Structured engineering rigor, Tracked ZzzOps adherence, human_at_exhaustion review timing, one-writer ownership, exact-head discipline, approved local/direct validation, and fail-closed safety boundaries.; E-004: ZzzOps 2.1.0 init inspect — GitHub repository pixenetwork/discord is usable with Issues enabled; initialization head is 40c9b8a4113680d17ac9f00ffc235adcfa63ec0d.
  - Confidence/default: medium; immutable ZzzOps boundary → changed
  - Provenance: customized from a ZzzOps default
  - Settings: `{"production_mutation": "explicit_authority", "project_constraints": ["protect secrets and credentials", "fail closed on authorization, policy denial, or ambiguous execution", "escalate security-sensitive goals to Agentic rigor"], "secrets": "never_expose"}`
  - Exceptions: none
  - Unresolved: none
- [x] `[policy:documentation_style]` **Documentation and style** (applicable)
  - Decision: Follow evidenced repository documentation, style, and user-communication conventions.
  - Rationale: keep communication project-appropriate while providing a concise ZzzOps fallback
  - Sources: E-001: repository README/manifest/tree inspection — Maintain the dedicated Pixel Network Discord worker repository with bounded permissions, token safety, and auditable automation behavior.; E-002: repository inspection — Clean initialization snapshot; exact head is 40c9b8a4113680d17ac9f00ffc235adcfa63ec0d; no existing .zzzops/POLICY.json was present.; E-003: Athena portfolio ZzzOps policy review approved by user — Use Structured engineering rigor, Tracked ZzzOps adherence, human_at_exhaustion review timing, one-writer ownership, exact-head discipline, approved local/direct validation, and fail-closed safety boundaries.; E-004: ZzzOps 2.1.0 init inspect — GitHub repository pixenetwork/discord is usable with Issues enabled; initialization head is 40c9b8a4113680d17ac9f00ffc235adcfa63ec0d.
  - Confidence/default: medium; ZzzOps fallback overridden by repository or user evidence → changed
  - Provenance: customized from a ZzzOps default
  - Settings: `{"communication": {"style": "outcome_first", "technical_detail": "decision_risk_failure_or_request", "user_action": "one_clear_action_with_reason_and_next_step"}, "documentation": "repository_conventions", "style": "repository_conventions"}`
  - Exceptions: none
  - Unresolved: none
- [x] `[policy:deployment_resources]` **Deployment, environment, and resources** (applicable)
  - Decision: Do not deploy without explicit authority; authoritative execution and validation use approved local/direct paths, never GitHub Actions runners.
  - Rationale: Matches ai-orchestrator execution and CI/runner policy while retaining bounded size-aware parallelism.
  - Sources: E-001: repository README/manifest/tree inspection — Maintain the dedicated Pixel Network Discord worker repository with bounded permissions, token safety, and auditable automation behavior.; E-002: repository inspection — Clean initialization snapshot; exact head is 40c9b8a4113680d17ac9f00ffc235adcfa63ec0d; no existing .zzzops/POLICY.json was present.; E-003: Athena portfolio ZzzOps policy review approved by user — Use Structured engineering rigor, Tracked ZzzOps adherence, human_at_exhaustion review timing, one-writer ownership, exact-head discipline, approved local/direct validation, and fail-closed safety boundaries.; E-004: ZzzOps 2.1.0 init inspect — GitHub repository pixenetwork/discord is usable with Issues enabled; initialization head is 40c9b8a4113680d17ac9f00ffc235adcfa63ec0d.
  - Confidence/default: medium; ZzzOps conservative fallback → changed
  - Provenance: customized from a ZzzOps default
  - Settings: `{"delegate_wait_after_seconds": 60, "deployment": "explicit_authority", "resource_mode": "size_aware"}`
  - Exceptions: none
  - Unresolved: none
- [x] `[policy:engineering_rigor]` **Engineering rigor** (applicable)
  - Decision: structured
  - Rationale: Structured is the portfolio baseline; automatic escalation remains enabled for authentication, authorization, secrets, destructive migrations, payments, and security-sensitive work.
  - Sources: E-001: repository README/manifest/tree inspection — Maintain the dedicated Pixel Network Discord worker repository with bounded permissions, token safety, and auditable automation behavior.; E-002: repository inspection — Clean initialization snapshot; exact head is 40c9b8a4113680d17ac9f00ffc235adcfa63ec0d; no existing .zzzops/POLICY.json was present.; E-003: Athena portfolio ZzzOps policy review approved by user — Use Structured engineering rigor, Tracked ZzzOps adherence, human_at_exhaustion review timing, one-writer ownership, exact-head discipline, approved local/direct validation, and fail-closed safety boundaries.; E-004: ZzzOps 2.1.0 init inspect — GitHub repository pixenetwork/discord is usable with Issues enabled; initialization head is 40c9b8a4113680d17ac9f00ffc235adcfa63ec0d.
  - Confidence/default: medium; ZzzOps production-oriented fallback → changed
  - Provenance: customized from a ZzzOps default
  - Settings: `{"escalation": {"allow_automatic_deescalation": false, "allow_automatic_escalation": true, "enabled": true}, "minimums": {"authentication": "agentic", "authorization": "agentic", "destructive_data_migrations": "agentic", "payments": "agentic", "secrets": "agentic", "security_sensitive": "agentic", "throwaway_prototypes": "vibe"}, "overrides": {"lowering": "explicit_user_authority", "may_undercut_risk_minimum": false, "per_goal": true, "raising": "allowed"}, "requirements_interview": {"level_mapping": {"agentic": "thorough", "structured": "standard", "vibe": "light"}, "source": "effective_engineering_rigor"}}`
  - Exceptions: none
  - Unresolved: none
- [x] `[policy:workflow_adherence]` **ZzzOps workflow adherence** (applicable)
  - Decision: tracked
  - Rationale: Substantial agent work requires durable goal context while read-only investigation and ZzzOps administration remain exempt.
  - Sources: E-001: repository README/manifest/tree inspection — Maintain the dedicated Pixel Network Discord worker repository with bounded permissions, token safety, and auditable automation behavior.; E-002: repository inspection — Clean initialization snapshot; exact head is 40c9b8a4113680d17ac9f00ffc235adcfa63ec0d; no existing .zzzops/POLICY.json was present.; E-003: Athena portfolio ZzzOps policy review approved by user — Use Structured engineering rigor, Tracked ZzzOps adherence, human_at_exhaustion review timing, one-writer ownership, exact-head discipline, approved local/direct validation, and fail-closed safety boundaries.; E-004: ZzzOps 2.1.0 init inspect — GitHub repository pixenetwork/discord is usable with Issues enabled; initialization head is 40c9b8a4113680d17ac9f00ffc235adcfa63ec0d.
  - Confidence/default: medium; ZzzOps tracked-work fallback → changed
  - Provenance: customized from a ZzzOps default
  - Settings: `{"agents_projection": "review_workflow_reconciliation", "exemptions": ["read_only_investigation", "zzzops_administration"], "levels": {"managed": "zzzops_workflow_required_for_repository_changes", "optional": "direct_agent_work_allowed", "tracked": "durable_goal_required_for_substantial_agent_work"}, "scoped_exception": "explicit_scoped_user_authority"}`
  - Exceptions: none
  - Unresolved: none
- [x] `[policy:automated_design]` **Automated design authority** (applicable)
  - Decision: enabled
  - Rationale: Enable only bounded in-scope design choices with explicit hard stops for product scope, public contracts, destructive migrations, spending, deployment, external writes, review, safety, and higher authority.
  - Sources: E-001: repository README/manifest/tree inspection — Maintain the dedicated Pixel Network Discord worker repository with bounded permissions, token safety, and auditable automation behavior.; E-002: repository inspection — Clean initialization snapshot; exact head is 40c9b8a4113680d17ac9f00ffc235adcfa63ec0d; no existing .zzzops/POLICY.json was present.; E-003: Athena portfolio ZzzOps policy review approved by user — Use Structured engineering rigor, Tracked ZzzOps adherence, human_at_exhaustion review timing, one-writer ownership, exact-head discipline, approved local/direct validation, and fail-closed safety boundaries.; E-004: ZzzOps 2.1.0 init inspect — GitHub repository pixenetwork/discord is usable with Issues enabled; initialization head is 40c9b8a4113680d17ac9f00ffc235adcfa63ec0d.
  - Confidence/default: medium; ZzzOps bounded-commitment automated-design fallback → changed
  - Provenance: customized from a ZzzOps default
  - Settings: `{"commitment": {"high": "compare_evidence_cost_signal_or_explicit_current_design_review", "low": "replace_verify_and_clean_within_one_goal_before_fanout", "structural_cost_signals": ["affected_goal_units", "started_descendant_branches", "started_descendant_prs", "durable_data", "public_or_integration_contracts", "external_state", "compatibility_paths", "verification_breadth", "clean_removal_path"]}, "decision_record": ["alternatives", "rationale", "assumptions", "falsifiable_validation_signal"], "hard_stops": ["product_scope", "incompatible_public_contract", "destructive_migration", "external_spending", "deployment", "external_write", "human_review", "safety_authority", "higher_authority"], "insufficient_evidence": "durable_design_blocker", "privacy_security": "unambiguously_risk_reducing_without_material_behavior_change", "scope": "bounded_commitment_in_scope_implementation", "selection_basis": ["project_objectives", "kpi_evidence", "constraints", "precedence"]}`
  - Exceptions: none
  - Unresolved: none
- [x] `[policy:autonomy_approval_parallelism]` **Autonomy, approvals, and parallelism** (applicable)
  - Decision: Interview thoroughly during goal capture; execute unattended within reviewed authority; allow multiple writer lanes only when their file/resource scopes are explicitly non-overlapping; keep one writer per coherent surface; use up to three size-aware worktree workers.
  - Rationale: Matches ai-orchestrator one-writer-per-surface governance and repository size while preserving bounded parallel throughput.
  - Sources: E-001: repository README/manifest/tree inspection — Maintain the dedicated Pixel Network Discord worker repository with bounded permissions, token safety, and auditable automation behavior.; E-002: repository inspection — Clean initialization snapshot; exact head is 40c9b8a4113680d17ac9f00ffc235adcfa63ec0d; no existing .zzzops/POLICY.json was present.; E-003: Athena portfolio ZzzOps policy review approved by user — Use Structured engineering rigor, Tracked ZzzOps adherence, human_at_exhaustion review timing, one-writer ownership, exact-head discipline, approved local/direct validation, and fail-closed safety boundaries.; E-004: ZzzOps 2.1.0 init inspect — GitHub repository pixenetwork/discord is usable with Issues enabled; initialization head is 40c9b8a4113680d17ac9f00ffc235adcfa63ec0d.
  - Confidence/default: medium; ZzzOps conservative fallback → changed
  - Provenance: customized from a ZzzOps default
  - Settings: `{"blocker_interview": "capture_only", "blocker_order": ["safety_access_human", "cross_goal_decisions", "specification", "technical_unknown"], "capture_defaults": {"confidence": "low", "difficulty": "unknown", "priority": "P2"}, "claim_ttl_hours": 4, "dependency_implementation_gate": "stack_from_reviewed_checkpoint", "execution_reports": {"enabled": true}, "max_workers": 3, "parallelization": {"at_or_above_threshold_mode": "read_only", "below_threshold_mode": "worktrees", "measurement": "existing_git_tracked_worktree_bytes", "threshold_bytes": 104857600}, "planning": {"decompose_at": "L", "max_depth": 3}, "project_parallel_ceiling": "size_aware", "read_only_dependency_investigation": true, "refill": {"allowed_categories": ["documentation", "tests", "code_quality_non_behavioral"], "enabled": true, "max_per_run": 3}, "requirements_interview": {"capture_depth": "standard", "execution_questions": "durable_blockers_only", "mode": "adaptive", "stakeholder_model": "requesting_user_only"}, "resource_reservations": {"exclusive_prefixes": ["generated", "external"], "exclusive_resources": [], "mode": "conflict_tolerant"}, "worktree_lifecycle": {"abandoned_or_dirty": "forbidden", "after_task": "remove_or_retain_clean_for_reuse", "reuse_requires": ["clean_state", "reviewed_base", "new_goal_resources", "safe_branch_reassignment"]}}`
  - Exceptions: none
  - Unresolved: none

## Review record

| Date | Actor/run | Change | Reason/evidence |
| --- | --- | --- | --- |
| 2026-09-06 | ZzzOps initialization | Created pending revision 1 | Confirmed agent-generated draft; explicit policy review still required. |
| 2026-09-06 | duy | Reviewed policy revision 2 | Approved: backend, git_review_release, execution_continuation, verification_testing, code_quality, dependencies_tooling, security_privacy_compliance, documentation_style, deployment_resources, engineering_rigor, workflow_adherence, automated_design, autonomy_approval_parallelism; source digest sha256:344d52f315ec09ee72e80529f537cedbf3c2f006d40d67de35a11bbc50a9777b. |

The machine-readable authority is [POLICY.json](POLICY.json); this file is its human audit view.
