// Requiring this module first installs a minimal `electron` stub into the
// module loader, so main-process service modules that do
// `const { app, shell } = require('electron')` can be unit-tested with a plain
// `node --test` run -- without electron (or any node_modules) installed.
//
// The stub only implements the surface the services touch at require time or in
// the code paths under test. Tests that need real behaviour (e.g. DBService
// queries) monkey-patch the service object directly instead.
const Module = require('module')
const os = require('os')

const electronStub = {
  app: {
    getPath: () => os.tmpdir(),
    getAppPath: () => process.cwd(),
    getName: () => 'agent-command-engine-test',
    getVersion: () => '0.0.0-test',
    isPackaged: false,
    setAboutPanelOptions: () => {},
  },
  shell: {
    showItemInFolder: () => {},
    openPath: async () => '',
    openExternal: async () => {},
  },
  ipcMain: { handle: () => {}, on: () => {} },
  BrowserWindow: function BrowserWindow() {},
  // buildFromTemplate returns the template so tests can introspect the menu.
  Menu: { setApplicationMenu: () => {}, buildFromTemplate: (template) => ({ template }) },
}

const originalLoad = Module._load
// Idempotent: requiring this helper from multiple test files must not stack
// interceptors on top of each other.
if (!Module._electronStubInstalled) {
  Module._electronStubInstalled = true
  Module._load = function patchedLoad(request, parent, isMain) {
    if (request === 'electron') return electronStub
    return originalLoad.apply(this, arguments)
  }
}

module.exports = { electronStub }
