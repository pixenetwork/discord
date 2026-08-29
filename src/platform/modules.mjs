const define = (key, category, description, options = {}) => Object.freeze({
  key,
  category,
  description,
  risk: options.risk ?? 'low',
  dependencies: Object.freeze([...(options.dependencies ?? [])]),
  approvalRequired: Boolean(options.approvalRequired),
  stateful: options.stateful !== false,
});

export const MODULES = Object.freeze([
  define('audit', 'core', 'Privileged action audit log and correlation IDs', { stateful: false }),
  define('health', 'core', 'Worker health/readiness and integration status', { stateful: false }),
  define('module_admin', 'core', 'Per-tenant module enable/disable administration', { dependencies: ['audit'] }),
  define('rbac', 'core', 'Canonical-role and explicit allowlist authorization', { dependencies: ['audit'] }),
  define('retention', 'core', 'Transcript/evidence retention controls', { dependencies: ['audit'] }),
  define('backups', 'core', 'Persistent state backup/restore metadata', { risk: 'medium', dependencies: ['audit'], approvalRequired: true }),
  define('ai_budget', 'core', 'AI usage/rate budgets and spend limits', { dependencies: ['audit'] }),

  define('tickets', 'support', 'Advanced configurable support ticket engine', { dependencies: ['audit', 'rbac'] }),
  define('ticket_panels', 'support', 'Multi-panel ticket entry points and custom forms', { dependencies: ['tickets'] }),
  define('ticket_claiming', 'support', 'Claim/unclaim and assignment workflow', { dependencies: ['tickets'] }),
  define('ticket_transcripts', 'support', 'Durable ticket transcripts and archives', { dependencies: ['tickets', 'retention'] }),
  define('ticket_reminders', 'support', 'Ticket inactivity reminders and escalation', { dependencies: ['tickets'] }),
  define('ticket_stats', 'support', 'Staff response/workload metrics', { dependencies: ['tickets'] }),
  define('bug_reports', 'support', 'Structured bug-report intake', { dependencies: ['tickets'] }),
  define('ban_appeals', 'support', 'Ban appeal intake and case linking', { dependencies: ['tickets', 'ban_evidence'] }),
  define('staff_reports', 'support', 'Restricted staff-report workflow', { dependencies: ['tickets', 'audit'] }),
  define('tebex_tickets', 'support', 'Tebex-enriched support tickets', { dependencies: ['tickets', 'tebex_verification'] }),
  define('ai_ticket_agent', 'support', 'Jarvis ticket triage, summaries, screenshot/log reasoning, and follow-up questions', { risk: 'medium', dependencies: ['tickets', 'audit', 'ai_budget'] }),
  define('known_issue_detection', 'support', 'Detect likely duplicate/known issues before opening new tickets', { dependencies: ['tickets', 'knowledge_base'] }),

  define('applications', 'applications', 'Configurable application engine', { dependencies: ['audit', 'rbac'] }),
  define('application_builder', 'applications', 'Custom application form builder', { dependencies: ['applications'] }),
  define('application_decisions', 'applications', 'Accept/deny with reason and review history', { dependencies: ['applications'] }),
  define('application_roles', 'applications', 'Approval-driven automatic role assignment', { risk: 'medium', dependencies: ['applications', 'rbac', 'audit'] }),

  define('fivem_status', 'fivem', 'Live FiveM status, players, queue, and server state', { dependencies: ['audit'] }),
  define('txadmin_restarts', 'fivem', 'txAdmin restart/countdown notifications', { dependencies: ['fivem_status'] }),
  define('server_stat_channels', 'fivem', 'Auto-updated player/status statistic channels', { dependencies: ['fivem_status'] }),
  define('ban_evidence', 'fivem', 'Evidence attachment and case timeline for bans', { dependencies: ['audit', 'retention'] }),
  define('ban_lookup', 'fivem', 'Ban lookup and linked appeal/report history', { dependencies: ['ban_evidence'] }),
  define('sits_tracker', 'fivem', 'Staff sit tracking and leaderboards', { dependencies: ['audit', 'rbac'] }),
  define('staff_duty', 'fivem', 'Staff duty/on-shift tracking', { dependencies: ['audit', 'rbac'] }),
  define('incident_command', 'fivem', 'Scoped incident rooms, timeline, ownership, and postmortem', { risk: 'medium', dependencies: ['audit', 'retention', 'fivem_status'] }),
  define('restart_control', 'fivem', 'Approval-gated production restart control', { risk: 'high', dependencies: ['fivem_status', 'audit', 'rbac'], approvalRequired: true }),

  define('gang_manager', 'gang', 'Gang creation, owner/member management, slots, and roles', { risk: 'medium', dependencies: ['audit', 'rbac'] }),
  define('gang_strikes', 'gang', 'Gang strike history and escalation', { dependencies: ['gang_manager', 'audit'] }),
  define('queue_priority', 'gang', 'Purchased queue priority tiers and role synchronization', { risk: 'medium', dependencies: ['gang_manager', 'rbac', 'audit'] }),

  define('verification', 'community', 'Configurable member verification panels', { dependencies: ['audit', 'rbac'] }),
  define('vanity_roles', 'community', 'Vanity/status based role assignment', { dependencies: ['rbac', 'audit'] }),
  define('sticky_roles', 'community', 'Restore configured roles for returning members', { dependencies: ['rbac', 'audit'] }),
  define('auto_roles', 'community', 'Automatic role assignment on join/verification', { dependencies: ['rbac', 'audit'] }),
  define('sticky_messages', 'community', 'Keep configured messages visible at channel bottom', { dependencies: ['audit'] }),
  define('keyword_responses', 'community', 'Configurable keyword response rules', { dependencies: ['audit'] }),
  define('welcome', 'community', 'Welcome/onboarding messages', { dependencies: ['audit'] }),
  define('booster_responder', 'community', 'Server booster acknowledgement and perks hooks', { dependencies: ['audit'] }),
  define('polls', 'community', 'Managed Discord community polls', { dependencies: ['audit'] }),
  define('translation', 'community', 'Message translation tools', { dependencies: ['ai_budget', 'audit'] }),
  define('status_blacklist', 'community', 'Detect prohibited custom status text for moderation review', { risk: 'medium', dependencies: ['audit', 'rbac'] }),
  define('mass_unban', 'community', 'Owner-only confirmation-gated bulk unban', { risk: 'high', dependencies: ['audit', 'rbac'], approvalRequired: true }),
  define('staff_feedback', 'community', 'Staff feedback/upvote/downvote workflow', { dependencies: ['audit', 'rbac'] }),

  define('tebex_verification', 'commerce', 'Tebex transaction and entitlement verification', { dependencies: ['audit'] }),
  define('tebex_fraud_flags', 'commerce', 'Duplicate/fraud indicators for manual staff review', { risk: 'medium', dependencies: ['tebex_verification', 'audit'] }),

  define('knowledge_base', 'jarvis', 'Searchable server/script documentation and FAQ', { dependencies: ['audit'] }),
  define('screenshot_intelligence', 'jarvis', 'Screenshot/image understanding for support and evidence', { risk: 'medium', dependencies: ['audit', 'ai_budget'] }),
  define('log_correlation', 'jarvis', 'Correlate screenshots/tickets with server log windows', { risk: 'medium', dependencies: ['audit'] }),
  define('github_handoff', 'jarvis', 'Create/link engineering issues for confirmed bugs', { risk: 'medium', dependencies: ['tickets', 'audit'] }),
  define('trello_handoff', 'jarvis', 'Route approved tasks into Trello', { risk: 'medium', dependencies: ['tickets', 'audit'] }),
  define('slack_handoff', 'jarvis', 'Route approved alerts/tasks into Slack', { risk: 'medium', dependencies: ['tickets', 'audit'] }),
  define('resolution_sync', 'jarvis', 'Post engineering resolution state back to originating tickets', { dependencies: ['tickets', 'github_handoff'] }),
  define('customer_script_support', 'jarvis', 'Product-specific support queues for sold Pixel Network scripts', { dependencies: ['tickets', 'knowledge_base', 'audit'] }),
  define('license_entitlements', 'jarvis', 'Check product/support entitlements before private paid support', { risk: 'medium', dependencies: ['customer_script_support', 'audit'] }),
]);

export const MODULE_BY_KEY = Object.freeze(Object.fromEntries(MODULES.map((module) => [module.key, module])));
export const ALL_MODULE_KEYS = Object.freeze(MODULES.map((module) => module.key));

/** High-impact modules stay off until explicitly enabled (and remain approval-gated). */
const DEFAULT_OFF_MODULE_KEYS = Object.freeze(['restart_control', 'mass_unban']);

export function defaultModuleState() {
  return Object.fromEntries(ALL_MODULE_KEYS.map((key) => [key, ['audit', 'health', 'module_admin', 'rbac'].includes(key)]));
}

export function fullSuiteModuleState() {
  return Object.fromEntries(ALL_MODULE_KEYS.map((key) => [key, !DEFAULT_OFF_MODULE_KEYS.includes(key)]));
}

export { DEFAULT_OFF_MODULE_KEYS };

export function validateModuleState(input) {
  const state = { ...defaultModuleState(), ...(input ?? {}) };
  for (const [key, value] of Object.entries(state)) {
    if (!MODULE_BY_KEY[key]) throw new Error(`Unknown Discord module: ${key}`);
    if (typeof value !== 'boolean') throw new Error(`Module ${key} must be true or false`);
  }
  for (const module of MODULES) {
    if (!state[module.key]) continue;
    for (const dependency of module.dependencies) {
      if (!state[dependency]) {
        throw new Error(`Module ${module.key} requires enabled dependency ${dependency}`);
      }
    }
  }
  return Object.freeze(state);
}

export function enableModule(state, key) {
  const module = MODULE_BY_KEY[key];
  if (!module) throw new Error(`Unknown Discord module: ${key}`);
  const next = { ...defaultModuleState(), ...(state ?? {}) };
  const enableWithDependencies = (moduleKey) => {
    const current = MODULE_BY_KEY[moduleKey];
    if (!current) throw new Error(`Unknown Discord module: ${moduleKey}`);
    for (const dependency of current.dependencies) enableWithDependencies(dependency);
    next[moduleKey] = true;
  };
  enableWithDependencies(key);
  return validateModuleState(next);
}

export function disableModule(state, key) {
  if (!MODULE_BY_KEY[key]) throw new Error(`Unknown Discord module: ${key}`);
  const next = { ...defaultModuleState(), ...(state ?? {}), [key]: false };
  const dependents = MODULES.filter((module) => module.dependencies.includes(key) && next[module.key]);
  if (dependents.length) {
    throw new Error(`Cannot disable ${key} while enabled modules depend on it: ${dependents.map((module) => module.key).join(', ')}`);
  }
  return validateModuleState(next);
}

export function approvalGatedModules(state) {
  const validated = validateModuleState(state);
  return MODULES.filter((module) => validated[module.key] && module.approvalRequired).map((module) => module.key);
}
