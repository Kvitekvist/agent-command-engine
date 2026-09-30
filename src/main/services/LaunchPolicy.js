const { DBService } = require('./DBService')

const DEFAULT_MODEL_BY_PROVIDER = Object.freeze({
  claude: 'claude-sonnet-5',
  codex: 'gpt-5.6-terra',
})

const PROVIDERS = new Set(Object.keys(DEFAULT_MODEL_BY_PROVIDER))

function normalizeProvider(provider) {
  if (provider == null || provider === '' || provider === 'auto') return null
  if (!PROVIDERS.has(provider)) throw new Error(`Unsupported provider: ${provider}`)
  return provider
}

// Resolve provider and model as one decision. Auto deliberately ignores a
// renderer-supplied model because it may belong to the other provider.
function resolveLaunchPolicy({ provider, model, projectId } = {}, deps = {}) {
  const getSetting = deps.getSetting || ((key) => DBService.getSetting(key))
  const decideProvider = deps.decideProvider || (({ manualProvider }) => manualProvider || 'claude')

  const manualProvider = normalizeProvider(provider)
  const resolvedProvider = normalizeProvider(decideProvider({ manualProvider, projectId }))
  if (!resolvedProvider) throw new Error('Provider routing did not select a provider')

  const configuredProviderValue = getSetting('default_provider')
  const configuredProvider = PROVIDERS.has(configuredProviderValue)
    ? configuredProviderValue
    : null
  const configuredModel = getSetting('default_model')
  const requestedModel = typeof model === 'string' ? model.trim() : ''
  const resolvedModel = (manualProvider && requestedModel)
    || (manualProvider && configuredProvider === resolvedProvider && configuredModel)
    || DEFAULT_MODEL_BY_PROVIDER[resolvedProvider]

  // Allows the ids Claude Code's /model list uses: a Vertex-style `@date`
  // (claude-haiku-4-5@20251001) and a context suffix (claude-opus-5-5[1m]).
  // agentLaunch quotes every argument, so these reach the CLI verbatim.
  if (typeof resolvedModel !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._:@-]{0,127}(\[[a-z0-9]{1,8}\])?$/.test(resolvedModel)) {
    throw new Error('Invalid model ID')
  }
  return { provider: resolvedProvider, model: resolvedModel, automatic: !manualProvider }
}

module.exports = { DEFAULT_MODEL_BY_PROVIDER, normalizeProvider, resolveLaunchPolicy }
