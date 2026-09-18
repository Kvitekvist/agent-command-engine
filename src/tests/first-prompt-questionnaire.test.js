const assert = require('node:assert/strict')
const test = require('node:test')

async function loadHelpers() {
  return import('../renderer/utils/firstPromptQuestionnaire.mjs')
}

test('buildFirstPrompt joins only the fields that were filled in', async () => {
  const { buildFirstPrompt } = await loadHelpers()
  const prompt = buildFirstPrompt({
    topic: '  Add dark mode  ',
    description: 'Users want a toggle in Settings',
    avoidInclude: 'Avoid a new dependency',
    doneLooksLike: 'Toggle persists across restarts',
  })

  assert.match(prompt, /^Add dark mode/)
  assert.match(prompt, /Context: Users want a toggle in Settings/)
  assert.match(prompt, /Avoid\/include: Avoid a new dependency/)
  assert.match(prompt, /Done when: Toggle persists across restarts/)
})

test('buildFirstPrompt skips blank fields and never crashes on missing input', async () => {
  const { buildFirstPrompt } = await loadHelpers()
  assert.equal(buildFirstPrompt({ topic: '  Add dark mode  ' }), 'Add dark mode')
  assert.equal(buildFirstPrompt({}), '')
  assert.equal(buildFirstPrompt(), '')
})
