const { electronStub } = require('./helpers/electron-stub')

const assert = require('node:assert/strict')
const test = require('node:test')
const { buildMenu } = require('../main/menu')

// buildFromTemplate is stubbed to return { template }, so `.template` is the
// array passed to Electron.
const isMac = process.platform === 'darwin'

function labels(menu) {
  return menu.template.map((m) => m.label || m.role)
}
function itemLabels(menu, topLabel) {
  const top = menu.template.find((m) => (m.label || m.role) === topLabel)
  return (top?.submenu || []).map((i) => i.label || i.role || i.type)
}
// Every item across every top-level submenu, one level deep -- macOS moves
// Settings/About into the app menu, so tests search by content, not position.
function allItems(menu) {
  return menu.template.flatMap((m) => m.submenu || [])
}

test('menu has the standard top-level sections', () => {
  const menu = buildMenu(null)
  const top = labels(menu)
  assert.ok(top.includes('File'))
  assert.ok(top.includes('editMenu'))
  assert.ok(top.includes('View'))
  assert.ok(top.includes('windowMenu'))
  assert.ok(top.includes('help'))
})

test('Settings item carries the CmdOrCtrl+, accelerator and navigates to settings', () => {
  const menu = buildMenu({ webContents: { send: () => {} } })
  const settings = allItems(menu).find((i) => /Settings/.test(i.label || ''))
  assert.ok(settings, 'menu has a Settings item')
  assert.equal(settings.accelerator, 'CmdOrCtrl+,')

  // App menu on macOS, File menu elsewhere.
  const parent = isMac ? 'Agent Command Engine' : 'File'
  assert.ok(
    itemLabels(menu, parent).some((l) => /Settings/.test(l)),
    `Settings lives under ${parent}`,
  )

  let sent
  const menu2 = buildMenu({ webContents: { send: (ch, v) => { sent = [ch, v] } } })
  allItems(menu2).find((i) => /Settings/.test(i.label || '')).click()
  assert.deepEqual(sent, ['menu:navigate', 'settings'])
})

test('About and the external help links are present', () => {
  const menu = buildMenu(null)
  const help = itemLabels(menu, 'help')
  assert.ok(help.includes('Report an Issue'))
  assert.ok(help.includes('Documentation'))

  // About is in the app menu on macOS, the Help menu elsewhere.
  const aboutParent = isMac ? 'Agent Command Engine' : 'help'
  assert.ok(itemLabels(menu, aboutParent).includes('About Agent Command Engine'))
})

test('Reload / DevTools appear only in an unpackaged build', () => {
  electronStub.app.isPackaged = false
  assert.ok(itemLabels(buildMenu(null), 'View').includes('toggleDevTools'))

  electronStub.app.isPackaged = true
  const packedView = itemLabels(buildMenu(null), 'View')
  assert.ok(!packedView.includes('toggleDevTools'))
  assert.ok(!packedView.includes('reload'))
  assert.ok(packedView.includes('togglefullscreen'))

  electronStub.app.isPackaged = false
})
