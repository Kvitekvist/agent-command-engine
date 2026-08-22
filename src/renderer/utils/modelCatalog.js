// Models available to the subscription-backed CLIs. Keep the newest model
// versions first so the selector is useful even as the catalog grows.
//
// Claude entries use the canonical model IDs from Anthropic's model status
// page. Codex entries mirror the listable (non-internal) models in the local
// Codex CLI model cache.
export const MODEL_GROUPS_BY_PROVIDER = {
  claude: [
    {
      label: 'Claude 5',
      options: [
        { id: 'claude-fable-5', label: 'Claude Fable 5', description: 'Highest capability · long-running agents' },
        { id: 'claude-opus-5', label: 'Claude Opus 5', description: 'Complex coding and deep reasoning' },
        { id: 'claude-sonnet-5', label: 'Claude Sonnet 5', description: 'Recommended · speed and intelligence' },
      ],
    },
    {
      label: 'Claude 4',
      options: [
        { id: 'claude-opus-4-8', label: 'Claude Opus 4.8', description: 'Advanced agentic work' },
        { id: 'claude-opus-4-7', label: 'Claude Opus 4.7', description: 'Advanced reasoning' },
        { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6', description: 'Balanced coding' },
        { id: 'claude-opus-4-6', label: 'Claude Opus 4.6', description: 'Advanced reasoning' },
        { id: 'claude-opus-4-5-20251101', label: 'Claude Opus 4.5', description: 'Advanced reasoning' },
        { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5', description: 'Fastest and most economical' },
        { id: 'claude-sonnet-4-5-20250929', label: 'Claude Sonnet 4.5', description: 'Balanced coding' },
      ],
    },
  ],
  codex: [
    {
      label: 'GPT-5.6',
      options: [
        { id: 'gpt-5.6-sol', label: 'GPT-5.6 Sol', description: 'Frontier coding model' },
        { id: 'gpt-5.6-terra', label: 'GPT-5.6 Terra', description: 'Recommended · balanced everyday coding' },
        { id: 'gpt-5.6-luna', label: 'GPT-5.6 Luna', description: 'Fast and economical' },
      ],
    },
    {
      label: 'Earlier GPT-5',
      options: [
        { id: 'gpt-5.5', label: 'GPT-5.5', description: 'Complex coding and research' },
        { id: 'gpt-5.4', label: 'GPT-5.4', description: 'Everyday coding' },
        { id: 'gpt-5.4-mini', label: 'GPT-5.4 Mini', description: 'Small, fast, and economical' },
      ],
    },
  ],
}

export const DEFAULT_MODEL_BY_PROVIDER = {
  claude: 'claude-sonnet-5',
  codex: 'gpt-5.6-terra',
}
