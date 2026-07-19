/**
 * OptimizationAdvisor analyzes recent prompts and returns actionable suggestions
 * for reducing token usage without sacrificing output quality.
 */

const { DBService } = require('./DBService')

const OptimizationAdvisor = {
  analyze(projectId) {
    const prompts = DBService.getPrompts({ projectId, limit: 200 })
    if (!prompts.length) {
      return [{ type: 'info', message: 'No prompts logged yet for this project.' }]
    }

    const suggestions = []

    // 1. Very long prompts
    const longPrompts = prompts.filter((p) => (p.prompt_text || '').length > 3000)
    if (longPrompts.length > 3) {
      suggestions.push({
        type: 'warning',
        category: 'Prompt Length',
        message: `${longPrompts.length} prompts exceed 3,000 characters. Consider breaking large prompts into smaller tasks or summarizing context before sending.`,
        saving: 'High',
      })
    }

    // 2. Repeated system-level context (similar prompt prefixes)
    const prefixes = prompts.map((p) => (p.prompt_text || '').slice(0, 200))
    const duplicatePrefixes = prefixes.filter((p, i) => prefixes.indexOf(p) !== i)
    if (duplicatePrefixes.length > 5) {
      suggestions.push({
        type: 'warning',
        category: 'Repeated Context',
        message: `${duplicatePrefixes.length} prompts share nearly identical openings. Extract common context into a system prompt or project CLAUDE.md instead of repeating it in every message.`,
        saving: 'High',
      })
    }

    // 3. Model mismatch — using Opus/Sonnet for trivial tasks
    const heavyModelPrompts = prompts.filter(
      (p) => (p.model || '').includes('opus') && (p.prompt_text || '').length < 500
    )
    if (heavyModelPrompts.length > 2) {
      suggestions.push({
        type: 'tip',
        category: 'Model Selection',
        message: `${heavyModelPrompts.length} short prompts used a heavy model (Opus). Switch short/simple tasks to Haiku — up to 20x cheaper per token.`,
        saving: 'High',
      })
    }

    // 4. Low output-to-input ratio (context waste)
    const avgInputTokens = prompts.reduce((s, p) => s + (p.input_tokens || 0), 0) / prompts.length
    const avgOutputTokens = prompts.reduce((s, p) => s + (p.output_tokens || 0), 0) / prompts.length
    if (avgInputTokens > 0 && avgOutputTokens / avgInputTokens < 0.1) {
      suggestions.push({
        type: 'tip',
        category: 'Context Efficiency',
        message: `Average output is only ${Math.round((avgOutputTokens / avgInputTokens) * 100)}% of input size. You may be sending more context than needed. Try trimming conversation history or using --no-context flags.`,
        saving: 'Medium',
      })
    }

    // 5. High token variance (inconsistent prompt sizes)
    const tokenCounts = prompts.map((p) => (p.input_tokens || 0) + (p.output_tokens || 0))
    const mean = tokenCounts.reduce((a, b) => a + b, 0) / tokenCounts.length
    const variance = tokenCounts.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / tokenCounts.length
    if (Math.sqrt(variance) > mean * 1.5) {
      suggestions.push({
        type: 'info',
        category: 'Token Consistency',
        message: 'High variance in token usage across prompts. Some tasks may benefit from templated, fixed-size prompts to make budgeting more predictable.',
        saving: 'Low',
      })
    }

    // 6. Slow responses
    const slowPrompts = prompts.filter((p) => p.duration_ms > 30000)
    if (slowPrompts.length > 3) {
      suggestions.push({
        type: 'tip',
        category: 'Speed',
        message: `${slowPrompts.length} prompts took over 30 seconds. Consider splitting long tasks into parallel agents to reduce wall-clock time.`,
        saving: 'Speed',
      })
    }

    if (!suggestions.length) {
      suggestions.push({
        type: 'success',
        category: 'All Clear',
        message: 'No significant inefficiencies detected. Your prompts look well-optimized!',
        saving: 'None',
      })
    }

    const stats = {
      totalPrompts: prompts.length,
      totalTokens: prompts.reduce((s, p) => s + (p.input_tokens || 0) + (p.output_tokens || 0), 0),
      avgInputTokens: Math.round(avgInputTokens),
      avgOutputTokens: Math.round(avgOutputTokens),
    }

    return { suggestions, stats }
  },
}

module.exports = { OptimizationAdvisor }
