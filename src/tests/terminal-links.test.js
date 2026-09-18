const assert = require('node:assert/strict')
const test = require('node:test')

test('terminal file links preserve relative roots, quoted spaces and source locations', async () => {
  const { findFileLinks } = await import('../renderer/utils/terminalLinks.mjs')
  const text = 'See src/main/index.js:12:3 and "C:\\My Project\\file.txt" or README.md.'
  const links = findFileLinks(text)
  assert.deepEqual(links.map(link => link.path), ['src/main/index.js', 'C:\\My Project\\file.txt', 'README.md'])
  for (const link of links) assert.equal(text.slice(link.index, link.index + link.label.length), link.label)
  assert.deepEqual(findFileLinks('https://example.com/file.js javascript:alert(1)'), [])
  assert.equal(findFileLinks('./src/index.js')[0].path, './src/index.js')
  assert.equal(findFileLinks('/tmp/file.txt')[0].path, '/tmp/file.txt')
})

test('a path with a space survives when Claude/Codex mark its extent (backtick or tool-call parens)', async () => {
  const { findFileLinks } = await import('../renderer/utils/terminalLinks.mjs')

  const backticked = 'Edited `C:\\Users\\jensr\\My Documents\\file.js`'
  assert.equal(findFileLinks(backticked)[0].path, 'C:\\Users\\jensr\\My Documents\\file.js')

  const toolCall = '⏺ Read(C:\\Users\\jensr\\My Documents\\file.js)'
  assert.equal(findFileLinks(toolCall)[0].path, 'C:\\Users\\jensr\\My Documents\\file.js')

  // A tool-call's trailing :line still strips off the parenthesized path.
  const withLine = '⏺ Edit(src/main/My File.js:12)'
  assert.equal(findFileLinks(withLine)[0].path, 'src/main/My File.js')

  // Plain parenthetical prose (no path shape) still isn't linkified.
  assert.deepEqual(findFileLinks('(this took 3 seconds)'), [])
})

test('a bare, unquoted path with embedded spaces is bridged back together', async () => {
  const { findFileLinks } = await import('../renderer/utils/terminalLinks.mjs')

  // The exact case reported live: no quotes, no backticks, just prose.
  const text = 'C:\\Users\\jensr\\Documents\\VS Projects\\ACE\\README.md'
  const links = findFileLinks(text)
  assert.deepEqual(links.map(l => l.path), [text])
  assert.equal(text.slice(links[0].index, links[0].index + links[0].label.length), text)

  // Trailing prose after the path isn't swallowed.
  const withTrailer = findFileLinks(`See ${text} for details`)
  assert.deepEqual(withTrailer.map(l => l.path), [text])

  // Multiple embedded spaces in the same path all get bridged.
  const multiSpace = 'C:\\Program Files\\Common Files\\App\\file.exe'
  assert.deepEqual(findFileLinks(multiSpace).map(l => l.path), [multiSpace])

  // Two separate bare paths in the same line stay separate, each stopping
  // at its own filename instead of swallowing the word between them.
  const two = 'Files: C:\\Users\\jensr\\My Report.docx and C:\\Users\\jensr\\Another Report.docx'
  assert.deepEqual(findFileLinks(two).map(l => l.path), [
    'C:\\Users\\jensr\\My Report.docx',
    'C:\\Users\\jensr\\Another Report.docx',
  ])

  // A path-looking word doesn't reach backwards into an unrelated one.
  assert.deepEqual(findFileLinks('Read C:\\file and he/she said ok').map(l => l.path), ['C:\\file', 'he/she'])
})

test('Alt-click routes explicit URLs and file links through ACE and reports failures', async () => {
  const { openTerminalLink } = await import('../renderer/utils/terminalLinks.mjs')
  const calls = []
  const shell = {
    openUrl: async url => { calls.push(url); return { ok: true } },
    showInFolder: async (path, root) => { calls.push([path, root]); return { success: true } },
  }
  const event = { altKey: true, preventDefault() {} }
  await openTerminalLink({ altKey: false }, 'https://example.com', shell, '/project')
  assert.deepEqual(calls, [])
  await openTerminalLink(event, 'https://example.com', shell, '/project')
  await openTerminalLink(event, 'file:///tmp/file.txt', shell, '/project')
  await openTerminalLink(event, 'src/main/index.js', shell, '/project')
  assert.deepEqual(calls, ['https://example.com', ['file:///tmp/file.txt', '/project'], ['src/main/index.js', '/project']])
  await assert.rejects(openTerminalLink(event, 'javascript:alert(1)', shell, '/project'), /Unsupported/)
  await assert.rejects(openTerminalLink(event, 'missing.js', {
    showInFolder: async () => ({ success: false, error: 'Path does not exist' }),
  }, '/project'), /Path does not exist/)
})
