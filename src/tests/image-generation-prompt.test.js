const assert = require('node:assert/strict')
const test = require('node:test')

async function loadHelpers() {
  return import('../renderer/utils/imageGenerationPrompt.mjs')
}

test('buildImageGenerationPrompt creates an explicit Codex ImageGen request', async () => {
  const { buildImageGenerationPrompt } = await loadHelpers()
  const prompt = buildImageGenerationPrompt('  a  friendly robot mascot  ')

  assert.match(prompt, /available image generation capability/)
  assert.match(prompt, /a friendly robot mascot/)
  assert.match(prompt, /\.ace\/generated-images\//)
  assert.match(prompt, /exact relative path/)
  assert.ok(!prompt.includes('\n'))
})

test('buildImageGenerationPrompt rejects an empty brief', async () => {
  const { buildImageGenerationPrompt } = await loadHelpers()
  assert.equal(buildImageGenerationPrompt('   '), null)
  assert.equal(buildImageGenerationPrompt(null), null)
})
