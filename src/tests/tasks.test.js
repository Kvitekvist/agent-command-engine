// Coverage for the pure parse/serialize helpers backing the shared project
// Tasks panel (TasksPanel.jsx). The module under test is .mjs, loaded here
// via dynamic import() -- same pattern as notes.test.js.
const assert = require('node:assert/strict')
const test = require('node:test')

async function loadHelpers() {
  return import('../renderer/utils/tasks.mjs')
}

test('parseTasks: empty content yields no tasks', async () => {
  const { parseTasks } = await loadHelpers()
  assert.deepEqual(parseTasks(''), [])
  assert.deepEqual(parseTasks('   \n  '), [])
})

test('parseTasks: a task round-trips through serializeTasks, defaulting done to false', async () => {
  const { parseTasks, serializeTasks } = await loadHelpers()
  const tasks = [{ id: 'a', timestamp: '2026-10-18T10:00:00.000Z', text: 'Write the ticket' }]
  assert.deepEqual(parseTasks(serializeTasks(tasks)), [{ ...tasks[0], done: false }])
})

test('parseTasks: preserves done:true and CRLF line endings', async () => {
  const { parseTasks, serializeTasks } = await loadHelpers()
  const tasks = [
    { id: 'a', timestamp: '2026-10-18T10:00:00.000Z', text: 'first', done: true },
    { id: 'b', timestamp: '2026-10-18T10:05:00.000Z', text: 'second', done: false },
  ]
  const serialized = serializeTasks(tasks).replace(/\n/g, '\r\n')
  assert.deepEqual(parseTasks(serialized), tasks)
})

test('parseTasks: rejects an entry missing text or timestamp', async () => {
  const { parseTasks } = await loadHelpers()
  assert.throws(() => parseTasks(JSON.stringify({ id: 'a', timestamp: '2026-10-18T10:00:00.000Z' }) + '\n'))
})
