const { electronStub } = require('./helpers/electron-stub')

const assert = require('node:assert/strict')
const test = require('node:test')
const { buildMenu } = require('../main/menu')

// buildFromTemplate is stubbed to return { template }, so `.template` is the
// array passed to Electron.
function labels(menu) {
  return menu.template.map((m) => m.label || m.role)
}
function itemLabels(menu, topLabel) {
  const top = menu.template.find((m) => (m.label || m.role) === topLabel)
  return (top.submenu || []).map((i) => i.label || i.role || i.type)
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
  const file = menu.template.find((m) => m.label === 'File')
  const settings = file.submenu.find((i) => /Settings/.test(i.label || ''))
  assert.ok(settings, 'File menu has a Settings item')
  assert.equal(settings.accelerator, 'CmdOrCtrl+,')

  let sent
  const menu2 = buildMenu({ webContents: { send: (ch, v) => { sent = [ch, v] } } })
  menu2.template.find((m) => m.label === 'File').submenu
    .find((i) => /Settings/.test(i.label || '')).click()
  assert.deepEqual(sent, ['menu:navigate', 'settings'])
})

test('Help menu exposes About and the external links', () => {
  const menu = buildMenu(null)
  const help = itemLabels(menu, 'help')
  assert.ok(help.includes('About Agent Command Engine'))
  assert.ok(help.includes('Report an Issue'))
  assert.ok(help.includes('Documentation'))
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
