const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')

function store(api = {}) {
  let state
  const create = initialize => {
    const set = update => { state = { ...state, ...(typeof update === 'function' ? update(state) : update) } }
    const get = () => state
    state = initialize(set, get)
    return { getState: get }
  }
  const source = fs.readFileSync(path.join(__dirname, '../renderer/store/useStore.js'), 'utf8')
    .replace("import { create } from 'zustand'", '').replace('export default useStore', 'useStore')
  return vm.runInNewContext(source, { create, window: { ace: api } }).getState
}

test('usage requests serialize, retain a queued refresh, and recover after failure', async () => {
  const pending = []
  const get = store({ getLiveTokenUsage: () => new Promise((resolve, reject) => pending.push({ resolve, reject })) })
  const first = get().loadLiveUsage()
  assert.equal(get().loadLiveUsage(), first)
  assert.equal(get().loadLiveUsage(), first)
  assert.equal(pending.length, 1)
  pending[0].resolve({ total: 1 })
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(pending.length, 2, 'one follow-up for activity during the request')
  pending[1].resolve({ total: 2 })
  await first
  assert.equal(get().liveUsage.total, 2)
  assert.equal(get().liveUsageLoading, false)
  const failed = get().loadLiveUsage()
  pending[2].reject(new Error('offline'))
  await failed
  assert.equal(get().liveUsageError, 'offline')
  assert.equal(get().liveUsage.total, 2, 'keep previous usage on transport failure')
  const retry = get().loadLiveUsage()
  pending[3].resolve({ total: 3 })
  await retry
  assert.equal(get().liveUsage.total, 3)
  assert.equal(get().liveUsageError, null)
})

test('active project selection, delayed saves and rename preserve editor buffers', () => {
  const get = store()
  get().setActiveProject({ id: 1 })
  get().openFile('/project/folder/a.txt', 'a.txt', 'disk')
  get().updateFileContent('/project/folder/a.txt', 'snapshot')
  get().setActiveProject({ id: 1 })
  assert.equal(get().openFiles[0].content, 'snapshot')
  get().updateFileContent('/project/folder/a.txt', 'new typing')
  get().markFileSaved('/project/folder/a.txt', 'snapshot')
  assert.equal(get().openFiles[0].originalContent, 'snapshot')
  assert.equal(get().openFiles[0].dirty, true)
  get().reconcileFiles('/project/folder', '/project/renamed')
  assert.equal(get().activeFilePath, '/project/renamed/a.txt')
  assert.equal(get().openFiles[0].content, 'new typing')
  get().reconcileFiles('/project/renamed', null)
  assert.equal(get().openFiles.length, 0)
  assert.equal(get().activeFilePath, null)
})
