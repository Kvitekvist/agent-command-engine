// Coverage for the pure parse/serialize helpers backing the shared project
// Notes panel (AgentTerminal.jsx + NotesPanel.jsx). The module under test is
// .mjs, loaded here via dynamic import() -- same pattern as
// first-line-capture.test.js.
const assert = require('node:assert/strict')
const test = require('node:test')
const path = require('node:path')
const { spawnSync } = require('node:child_process')

test('node map finds current Notes and Project Skills components near the top', () => {
  const root = path.resolve(__dirname, '../..')
  for (const [query, expected] of [['notes', 'NotesPanel.jsx'], ['project skills', 'ProjectSkillsPanel.jsx']]) {
    const result = spawnSync(process.execPath, [path.join(root, '.claude/skills/node-map/assets/brain.js'), query, path.join(root, 'docs/node-map.html'), '--json'], { encoding: 'utf8', windowsHide: true })
    assert.equal(result.status, 0, result.stderr)
    assert.equal(JSON.parse(result.stdout).results.some(row => row.path.endsWith(expected)), true)
  }
})

async function loadHelpers() {
  return import('../renderer/utils/notes.mjs')
}

test('parseNotes: empty content yields no notes', async () => {
  const { parseNotes } = await loadHelpers()
  assert.deepEqual(parseNotes(''), [])
  assert.deepEqual(parseNotes('   \n  '), [])
})

test('Notes retains horizontal rules, code blocks, Unicode and CRLF during migration', async () => {
  const { parseNotes, serializeNotes } = await loadHelpers()
  const body = 'Markdown\n---\n```js\nconst x = "æ 🐈"\n```'
  const timestamp = '2026-09-13T10:00:00.000Z'
  const legacy = (timestamp + '\n' + body).replace(/\n/g, '\r\n')
  assert.deepEqual(parseNotes(legacy), [{ timestamp, text: body }])
  assert.deepEqual(parseNotes(serializeNotes(parseNotes(legacy)).replace(/\n/g, '\r\n')), [{ timestamp, text: body }])
})

test('parseNotes: single-line note round-trips through serializeNotes', async () => {
  const { parseNotes, serializeNotes } = await loadHelpers()
  const notes = [{ timestamp: '2026-09-13T10:00:00.000Z', text: 'Remember to update the changelog.' }]
  const serialized = serializeNotes(notes)
  assert.deepEqual(parseNotes(serialized), notes)
})

test('parseNotes: multi-line note body is preserved', async () => {
  const { parseNotes, serializeNotes } = await loadHelpers()
  const notes = [{ timestamp: '2026-09-13T10:00:00.000Z', text: 'line one\nline two\nline three' }]
  assert.deepEqual(parseNotes(serializeNotes(notes)), notes)
})

test('parseNotes: multiple notes are split on the delimiter', async () => {
  const { parseNotes, serializeNotes } = await loadHelpers()
  const notes = [
    { timestamp: '2026-09-13T10:00:00.000Z', text: 'first note' },
    { timestamp: '2026-09-13T10:05:00.000Z', text: 'second\nnote' },
  ]
  assert.deepEqual(parseNotes(serializeNotes(notes)), notes)
})
