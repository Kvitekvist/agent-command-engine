const test = require('node:test')
const assert = require('node:assert')

test('detectPrompt reads the approval menu and ignores prose lists', async () => {
  const { detectPrompt } = await import('../renderer/utils/promptDetect.mjs')
  const menu = ['', 'Do you want to proceed?', '❯ 1. Yes', "  2. Yes, and don't ask again", '  3. No (esc)', '']
  const p = detectPrompt(menu)
  assert.deepStrictEqual(p.options.map(o => o.n), [1, 2, 3])
  assert.strictEqual(p.options[0].selected, true)
  assert.strictEqual(p.question, 'Do you want to proceed?')
  assert.strictEqual(detectPrompt(['Steps:', '1. do a', '2. do b']), null)
  assert.strictEqual(detectPrompt(['> hello']), null)
})
