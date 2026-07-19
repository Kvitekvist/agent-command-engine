/**
 * LoadBalancer decides which provider (claude | codex) to use for a new agent.
 * Strategy:
 *   - Default to Claude.
 *   - If codex fallback is enabled AND estimated Claude token budget is low, use Codex.
 *   - Manual override always wins.
 */

const { DBService } = require('./DBService')

const LoadBalancer = {
  /**
   * Decide provider for a new request.
   * @param {object} opts
   * @param {string} [opts.manualProvider]  - 'claude' | 'codex' | undefined (auto)
   * @param {number} [opts.projectId]
   * @returns {'claude' | 'codex'}
   */
  decide({ manualProvider, projectId } = {}) {
    if (manualProvider) return manualProvider

    const fallbackEnabled = DBService.getSetting('codex_fallback_enabled') === 'true'
    if (!fallbackEnabled) return 'claude'

    // Use recent token burn rate as a proxy for credit pressure.
    // If we've used > threshold tokens in the last hour, switch to Codex.
    const threshold = parseInt(DBService.getSetting('claude_credit_threshold') || '100000', 10)
    const recentUsage = this._recentClaudeTokens(projectId)

    return recentUsage > threshold ? 'codex' : 'claude'
  },

  _recentClaudeTokens(projectId) {
    // Inline SQL — avoids adding a new DBService method just for this
    try {
      const rows = DBService.getPrompts({ projectId, limit: 50 })
      const oneHourAgo = Date.now() - 3600 * 1000
      return rows
        .filter((r) => r.provider === 'claude' && new Date(r.created_at).getTime() > oneHourAgo)
        .reduce((sum, r) => sum + (r.input_tokens || 0) + (r.output_tokens || 0), 0)
    } catch (_) {
      return 0
    }
  },
}

module.exports = { LoadBalancer }
