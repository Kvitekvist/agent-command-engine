const assert = require('node:assert/strict')
const test = require('node:test')
const { pathToFileURL } = require('node:url')
const path = require('node:path')

const moduleUrl = pathToFileURL(path.join(__dirname, '..', 'renderer', 'utils', 'terminalPaste.mjs')).href

test('paste event data is used without reading the clipboard a second time', async () => {
  const { readPasteText } = await import(moduleUrl)
  let reads = 0
  const text = await readPasteText({
    clipboardData: { getData: (type) => type === 'text/plain' ? 'one paste' : '' },
  }, {
    readText: async () => { reads++; return 'duplicate paste' },
  })

  assert.equal(text, 'one paste')
  assert.equal(reads, 0)
})

test('clipboard fallback is read once when event data is unavailable', async () => {
  const { readPasteText } = await import(moduleUrl)
  let reads = 0
  const text = await readPasteText({}, {
    readText: async () => { reads++; return 'fallback paste' },
  })

  assert.equal(text, 'fallback paste')
  assert.equal(reads, 1)
})

test('image paste forwards captured bytes and uses terminal paste; failed saves insert nothing', async () => {
  const { pasteImage } = await import(moduleUrl)
  const inserted = []
  const terminal = { paste: text => inserted.push(text) }
  const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' })
  await pasteImage(blob, {
    saveImage: async (root, bytes) => {
      assert.equal(root, '/project')
      assert.deepEqual(bytes, new Uint8Array([1, 2, 3]))
      return { success: true, relativePath: 'assets/images/screenshots/pasted.png' }
    },
  }, '/project', terminal)
  assert.deepEqual(inserted, ['assets/images/screenshots/pasted.png'])
  await assert.rejects(pasteImage(blob, {
    saveImage: async () => ({ success: false, error: 'Disk is full' }),
  }, '/project', terminal), /Disk is full/)
  assert.equal(inserted.length, 1)
})
