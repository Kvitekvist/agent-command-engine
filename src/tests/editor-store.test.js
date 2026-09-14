const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')

function store() {
  let state
  const create = initialize => {
    const set = update => { state = { ...state, ...(typeof update === 'function' ? update(state) : update) } }
    const get = () => state
    state = initialize(set, get)
    return { getState: get }
  }
  const source = fs.readFileSync(path.join(__dirname, '../renderer/store/useStore.js'), 'utf8')
    .replace("import { create } from 'zustand'", '').replace('export default useStore', 'useStore')
  return vm.runInNewContext(source, { create }).getState
}

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
