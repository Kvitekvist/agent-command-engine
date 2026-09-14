const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

test('unset, empty and filtered model preferences have distinct launch choices', async () => {
  const source = fs.readFileSync(path.join(__dirname, '../renderer/utils/modelCatalog.js'))
  const { MODEL_GROUPS_BY_PROVIDER, filterGroupsByEnabled } = await import('data:text/javascript;base64,' + source.toString('base64'))
  for (const groups of Object.values(MODEL_GROUPS_BY_PROVIDER)) {
    assert.deepEqual(filterGroupsByEnabled(groups, null), groups)
    assert.deepEqual(filterGroupsByEnabled(groups, new Set()), [])
    const model = groups.at(-1).options.at(-1).id
    assert.deepEqual(filterGroupsByEnabled(groups, new Set([model])).flatMap(group => group.options.map(option => option.id)), [model])
  }
})
