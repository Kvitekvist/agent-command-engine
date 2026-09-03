const { app, Menu, shell } = require('electron')

// TICKET-0119: ACE previously shipped Electron's stock default menu -- no
// Settings, no About, and Reload / DevTools exposed in packaged builds. This
// module builds the menu by hand instead.

const REPO = 'https://github.com/Kvitekvist/agent-command-engine'
const isMac = process.platform === 'darwin'

// Populates the native About panel: the macOS app-menu "About" item and the
// Help -> About item on Windows/Linux (Electron >= 15 supports the `about`
// role on all three). Version comes from app.getVersion() -> src/package.json,
// the only authoritative source, so nothing here changes on a release.
function setAboutPanel() {
  app.setAboutPanelOptions({
    applicationName: 'Agent Command Engine',
    applicationVersion: app.getVersion(),
    // Windows/Linux render this as a second "build" line -- blank it out.
    version: '',
    copyright: `© ${new Date().getFullYear()} Jens`,
  })
}

function buildMenu(win) {
  const navigate = (view) => () => win && win.webContents.send('menu:navigate', view)

  const settingsItem = {
    label: isMac ? 'Settings…' : 'Settings',
    accelerator: 'CmdOrCtrl+,',
    click: navigate('settings'),
  }

  const aboutItem = { role: 'about', label: 'About Agent Command Engine' }

  // Reload / Force Reload / Toggle DevTools are a footgun in a shipped build --
  // a stray Ctrl+R drops editor tabs and view state, and DevTools is not for
  // end users -- so they only appear in an unpackaged dev run.
  const viewDevItems = app.isPackaged
    ? []
    : [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
      ]

  const template = [
    ...(isMac
      ? [{
          label: 'Agent Command Engine',
          submenu: [
            aboutItem,
            { type: 'separator' },
            settingsItem,
            { type: 'separator' },
            { role: 'services' },
            { type: 'separator' },
            { role: 'hide' },
            { role: 'hideOthers' },
            { role: 'unhide' },
            { type: 'separator' },
            { role: 'quit' },
          ],
        }]
      : []),
    {
      label: 'File',
      submenu: [
        ...(isMac ? [] : [settingsItem, { type: 'separator' }]),
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },
    { role: 'editMenu' },
    {
      label: 'View',
      submenu: [
        ...viewDevItems,
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    { role: 'windowMenu' },
    {
      role: 'help',
      submenu: [
        ...(isMac ? [] : [aboutItem, { type: 'separator' }]),
        { label: 'Report an Issue', click: () => shell.openExternal(`${REPO}/issues/new`) },
        { label: 'Documentation', click: () => shell.openExternal(`${REPO}#readme`) },
      ],
    },
  ]

  return Menu.buildFromTemplate(template)
}

module.exports = { buildMenu, setAboutPanel }
