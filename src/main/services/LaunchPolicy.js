const { DBService } = require('./DBService')
const { LoadBalancer } = require('./LoadBalancer')

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
  const decideProvider = deps.decideProvider || ((opts) => LoadBalancer.decide(opts))

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

  return { provider: resolvedProvider, model: resolvedModel, automatic: !manualProvider }
}

module.exports = { DEFAULT_MODEL_BY_PROVIDER, normalizeProvider, resolveLaunchPolicy }
