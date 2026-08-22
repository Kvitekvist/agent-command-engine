// TICKET-0070: coverage for the pure first-line capture / title-derivation
// helper backing the auto-title feature (AgentTerminal.jsx). The module
// under test is .mjs (see its own header comment for why) so it's loaded
// here via dynamic import() rather than require().
const assert = require('node:assert/strict')
const test = require('node:test')

async function loadHelpers() {
  return import('../renderer/utils/firstLineCapture.mjs')
}

test('feedLineCapture: plain typed line finalizes on \\r', async () => {
  const { feedLineCapture } = await loadHelpers()
  let state = { buffer: '' }
  for (const ch of 'fix login bug') {
    state = { ...feedLineCapture(state.buffer, ch) }
  }
  assert.equal(state.line, null)
  const final = feedLineCapture(state.buffer, '\r')
  assert.equal(final.line, 'fix login bug')
  assert.equal(final.buffer, '')
})

test('feedLineCapture: single chunk containing the whole line + \\r', async () => {
  const { feedLineCapture } = await loadHelpers()
  const result = feedLineCapture('', 'add dark mode toggle\r')
  assert.equal(result.line, 'add dark mode toggle')
})

test('feedLineCapture: backspace removes the last character', async () => {
  const { feedLineCapture } = await loadHelpers()
  // "helo" + backspace + "lo" -> "hello"
  const result = feedLineCapture('', 'helo\x7flo\r')
  assert.equal(result.line, 'hello')
})

test('feedLineCapture: backspace on an empty buffer is a no-op, not negative', async () => {
  const { feedLineCapture } = await loadHelpers()
  const result = feedLineCapture('', '\x7f\x7fhi\r')
  assert.equal(result.line, 'hi')
})

test('feedLineCapture: strips arrow-key/escape sequences instead of appending them', async () => {
  const { feedLineCapture } = await loadHelpers()
  // Up arrow (\x1b[A) followed by real text -- history recall keystrokes
  // some CLIs send shouldn't pollute the captured line.
  const result = feedLineCapture('', '\x1b[Ahello\r')
  assert.equal(result.line, 'hello')
})

test('feedLineCapture: an empty submitted line keeps waiting for the next one', async () => {
  const { feedLineCapture } = await loadHelpers()
  const first = feedLineCapture('', '\r')
  assert.equal(first.line, null)
  assert.equal(first.buffer, '')
  const second = feedLineCapture(first.buffer, 'now for real\r')
  assert.equal(second.line, 'now for real')
})

test('feedLineCapture: \\n also finalizes the line', async () => {
  const { feedLineCapture } = await loadHelpers()
  const result = feedLineCapture('', 'pasted line\n')
  assert.equal(result.line, 'pasted line')
})

test('deriveTitle: short text passes through unchanged', async () => {
  const { deriveTitle } = await loadHelpers()
  assert.equal(deriveTitle('fix login bug'), 'fix login bug')
})

test('deriveTitle: collapses internal whitespace and trims', async () => {
  const { deriveTitle } = await loadHelpers()
  assert.equal(deriveTitle('  fix   login   bug  '), 'fix login bug')
})

test('deriveTitle: truncates long text at a word boundary with an ellipsis', async () => {
  const { deriveTitle } = await loadHelpers()
  const long = 'implement a brand new dashboard widget that shows live token usage per project across every provider'
  const title = deriveTitle(long)
  assert.ok(title.length <= 61, `expected <=61 chars, got ${title.length}`)
  assert.ok(title.endsWith('…'))
  assert.ok(!title.slice(0, -1).endsWith(' '))
})
