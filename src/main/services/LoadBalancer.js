/**
 * LoadBalancer decides which provider (claude | codex) to use for a new agent.
 *   - A manual override always wins.
 *   - Otherwise default to Claude.
 *
 * TICKET-0083: the old credit-pressure heuristic read ACE's `prompts` table,
 * which interactive terminals stopped populating in TICKET-0019, so it always
 * saw zero burn and always returned 'claude'. Rebuilding it on real tokscale
 * usage is a separate piece of work; until then Auto simply means Claude.
 */

const LoadBalancer = {
  decide({ manualProvider } = {}) {
    return manualProvider || 'claude'
  },
}

module.exports = { LoadBalancer }
