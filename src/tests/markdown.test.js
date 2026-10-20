const test = require('node:test')
const assert = require('node:assert')

test('parseBlocks handles tables, nesting, quotes and fences', async () => {
  const { parseBlocks, splitRow, INLINE, classifyInline } = await import('../renderer/utils/markdown.mjs')

  const [table, after] = parseBlocks('| Name | Size |\n|:--|--:|\n| `a\\|b` | 1 |\n| c |\n\ntext')
  assert.strictEqual(table.t, 'table')
  assert.deepStrictEqual(table.head, ['Name', 'Size'])
  assert.deepStrictEqual(table.align, ['left', 'right'])
  assert.deepStrictEqual(table.rows, [['`a|b`', '1'], ['c', '']])
  assert.strictEqual(after.t, 'p')
  assert.deepStrictEqual(splitRow('| `x | y` | z |'), ['`x | y`', 'z'])

  const [list] = parseBlocks('1. one\n   - nested\n   - [x] done\n2. two\n\n   still two\n3. three')
  assert.strictEqual(list.ordered, true)
  assert.strictEqual(list.items.length, 3)
  const sub = list.items[0].blocks[1]
  assert.strictEqual(sub.t, 'list')
  assert.strictEqual(sub.items[1].check, true)
  assert.deepStrictEqual(list.items[1].blocks.map(b => b.t), ['p', 'p'])

  const blocks = parseBlocks('# Title\n> quoted\n> more\n\n---\n```js\nconst x = 1\n```\nplain')
  assert.deepStrictEqual(blocks.map(b => b.t), ['h', 'quote', 'hr', 'code', 'p'])
  assert.strictEqual(blocks[3].lang, 'js')
  assert.strictEqual(blocks[1].blocks[0].text, 'quoted\nmore')

  // Pipes in prose are not tables; a list ends at an unindented paragraph after a blank.
  assert.deepStrictEqual(parseBlocks('a | b\nnext').map(b => b.t), ['p'])
  assert.deepStrictEqual(parseBlocks('- a\n- b\n\nafter').map(b => b.t), ['list', 'p'])

  const spans = 'see **bold**, *em*, ~~old~~, `c*d`, snake_case_name and https://x.io/a.'.split(INLINE)
  const kinds = spans.filter((_, i) => i % 2).map(p => classifyInline(p).t)
  assert.deepStrictEqual(kinds, ['strong', 'em', 'del', 'code', 'link'])
  assert.strictEqual(classifyInline('https://x.io/a').href, 'https://x.io/a')
})
