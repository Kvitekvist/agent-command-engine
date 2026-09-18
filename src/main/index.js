const { app, BrowserWindow, Menu, ipcMain, dialog, nativeImage } = require('electron')
const path = require('path')
const fs = require('fs')
const { buildMenu, setAboutPanel } = require('./menu')

// Catch any uncaught exceptions in main process
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err)
  try {
    dialog.showErrorBox('Fatal Error', String(err?.stack || err))
  } catch (_) {}
})

process.on('unhandledRejection', (reason) => {
  console.error('UNHANDLED REJECTION:', reason)
  try {
    dialog.showErrorBox('Unhandled Promise Rejection', String(reason?.stack || reason))
  } catch (_) {}
})

// Keep everything ACE writes -- ace.db, ace-hooks/, skills-cache/ -- in one
// folder the user owns and can see, instead of hidden under %APPDATA% /
// ~/Library. Must run before anything reads app.getPath('userData')
// (DBService.init, HookService, handlers all do, from app.whenReady onward).
{
  const prevUserData = app.getPath('userData')
  let aceHome = path.join(app.getPath('documents'), 'ACE')
  try {
    fs.mkdirSync(aceHome, { recursive: true })
    fs.accessSync(aceHome, fs.constants.W_OK)
  } catch (_) {
    // e.g. an MSIX build without the documentsLibrary capability.
    aceHome = path.join(app.getPath('home'), '.ace')
    try { fs.mkdirSync(aceHome, { recursive: true }) } catch (_) {}
  }
  app.setPath('userData', aceHome)

  // One-time: carry an existing install's database forward. DBService also
  // migrates the older cpi.db name (TICKET-0071), so accept either here.
  const dst = path.join(aceHome, 'ace.db')
  if (!fs.existsSync(dst)) {
    for (const name of ['ace.db', 'cpi.db']) {
      const src = path.join(prevUserData, name)
      if (fs.existsSync(src)) {
        try { fs.copyFileSync(src, dst) } catch (_) {}
        break
      }
    }
  }
}

// Fall back to the bundled MinGit when git isn't on PATH (see GitPath.js).
// Must run before ptyHost is forked (TerminalService) or any `git` spawn --
// both inherit process.env, so mutating PATH once here covers every one of
// them, including agent terminals.
try {
  require('./services/GitPath').ensureGitOnPath({ packaged: app.isPackaged, resourcesPath: process.resourcesPath, appPath: app.getAppPath() })
} catch (err) {
  console.error('GitPath fallback failed:', err)
}

// TICKET-0153: a macOS/Linux GUI launch inherits launchd's minimal default
// PATH, not the login shell's -- so a genuinely installed Node.js can be
// invisible to prereqs:check even though it resolves fine in Terminal. Same
// spot/pattern as GitPath above: mutate process.env.PATH once, before
// anything spawns a child process.
try {
  require('./services/ShellPath').ensureShellPath()
} catch (err) {
  console.error('ShellPath fallback failed:', err)
}

let DBService, AgentService, TerminalService, registerHandlers

try {
  DBService = require('./services/DBService').DBService
  AgentService = require('./services/AgentService').AgentService
  TerminalService = require('./services/TerminalService').TerminalService
  registerHandlers = require('./ipc/handlers').registerHandlers
} catch (err) {
  console.error('MODULE LOAD ERROR:', err)
  app.whenReady().then(() => {
    dialog.showErrorBox('Module Load Error', String(err?.stack || err))
  })
}

let mainWindow = null
let closeApproved = false
let pendingClose = null
function requestClose(action) {
  if (pendingClose) { if (action === 'quit') pendingClose = action; return }
  pendingClose = action
  mainWindow.webContents.send('window:requestClose')
}
ipcMain.on('window:closeDecision', (event, approved) => {
  try { require('./ipc/handlers').assertAppSender(event, mainWindow) } catch (_) { return }
  const action = pendingClose
  pendingClose = null
  if (approved !== true || !action) return
  closeApproved = true
  if (action === 'quit') app.quit()
  else mainWindow.close()
})

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

// Dev-only window icon. The repo-root assets/ folder sits outside the packaged
// app directory (src/) and is not in electron-builder's `files` list, so in a
// packaged build this path resolved inside app.asar to a file that isn't there
// -- a silently dead reference. Nothing is lost by dropping it: Windows falls
// back to the executable's own icon (electron-builder's win.icon) and macOS
// ignores BrowserWindow's `icon` entirely in favour of the bundle icon.
const getIconPath = () => {
  if (app.isPackaged) return undefined
  const icon = path.join(__dirname, '../../assets/icons',
    process.platform === 'win32' ? 'icon.ico' : 'icon.icns')
  return fs.existsSync(icon) ? icon : undefined
}

// macOS ignores BrowserWindow's `icon` option, and an unpackaged dev run has
// no .app bundle for the OS to read an icon from, so `npm run dev` always
// shows the default Electron dock icon. A packaged build is fine (its bundle
// carries assets/icons/icon.icns via electron-builder's mac.icon). Set the dock icon
// explicitly in dev so it matches the packaged app. No-op when packaged (the
// bundle icon is correct) or off macOS (no app.dock). (TICKET-0069)
const setDevDockIcon = () => {
  if (process.platform !== 'darwin' || app.isPackaged || !app.dock) return
  // app.getAppPath() is the dir holding package.json (src/) in dev; the icon
  // assets live in the repo-root assets/icons/ folder one level up.
  const pngPath = path.join(app.getAppPath(), '..', 'assets', 'icons', 'icon.iconset', 'icon_512x512.png')
  try {
    if (!fs.existsSync(pngPath)) return
    const image = nativeImage.createFromPath(pngPath)
    if (!image.isEmpty()) app.dock.setIcon(image)
  } catch (err) {
    console.error('Failed to set dev dock icon:', err)
  }
}

// Single-instance lock (TICKET-0043). Without this, nothing stops a second
// ACE launch from opening a competing window. When more than one window is
// open, Windows routes keyboard input to whichever window holds OS focus —
// not necessarily the one the user is clicking in — so keystrokes aimed at
// the front window (e.g. the transient "new project" name field) silently
// land in a different ACE window. It also means two instances write the
// same on-disk ace.db (DBService rewrites the whole file on every write),
// a corruption risk. A second launch now just surfaces the existing window.
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.show()
      mainWindow.focus()
    }
  })
}

function createWindow() {
  closeApproved = false
  const iconPath = getIconPath()

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: '#0f1117',
    icon: iconPath, // Set window icon
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  mainWindow.webContents.on('will-navigate', event => event.preventDefault())
  mainWindow.webContents.on('will-redirect', event => event.preventDefault())
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))

  if (isDev) {
    const devUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173'
    console.log('Loading dev URL:', devUrl)
    mainWindow.loadURL(devUrl)
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(app.getAppPath(), 'dist/renderer/index.html'))
  }

  mainWindow.on('close', event => {
    if (!closeApproved) { event.preventDefault(); requestClose('close') }
  })
  mainWindow.on('closed', () => { mainWindow = null; pendingClose = null })
}

app.whenReady().then(async () => {
  // Lost the single-instance lock — the first instance is already running
  // (and has been focused via 'second-instance' above). Do nothing here so
  // this process never creates a window or opens ace.db before app.quit().
  if (!gotTheLock) return
  setDevDockIcon()

  try {
    console.log('Initializing DBService...')
    await DBService.init()
    console.log('DBService ready. Creating window...')
    createWindow()
    setAboutPanel()
    Menu.setApplicationMenu(buildMenu(mainWindow))
    AgentService.init(mainWindow)
    TerminalService.init(mainWindow)
    registerHandlers(ipcMain, () => mainWindow, DBService, AgentService, TerminalService)
    console.log('Startup complete.')
  } catch (err) {
    console.error('STARTUP ERROR:', err)
    dialog.showErrorBox('Startup Error', String(err?.stack || err))
  }

  app.on('activate', () => {
    // macOS: relaunching from the dock (or Cmd-Tab after closing the window)
    // fires 'activate'. Recreate the window AND re-point the services at it,
    // otherwise agent/terminal IPC events would still target the destroyed
    // window and silently go nowhere (TICKET-0070).
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
      Menu.setApplicationMenu(buildMenu(mainWindow))
      if (AgentService) AgentService.setWindow(mainWindow)
      if (TerminalService) TerminalService.setWindow(mainWindow)
    }
  })
})

// TICKET-0070: tear the services (and the forked PTY host) down only when the
// app is genuinely quitting -- NOT on 'window-all-closed'. On macOS closing the
// window does not quit the app, but the old handler still ran
// TerminalService.shutdown() there, which kills the PTY host and latches
// isShuttingDown=true with no path to revive it. Reopening the window via
// 'activate' then had a permanently dead host -> every new terminal failed
// ("posix_spawnp"/"host not available") until a full app restart. Windows/Linux
// were unaffected because there the app quits outright on window-all-closed.
let cleanupDone = false
app.on('before-quit', async (e) => {
  if (cleanupDone) return
  e.preventDefault()
  if (mainWindow && !closeApproved) { requestClose('quit'); return }
  if (AgentService) AgentService.killAll()
  if (TerminalService) await TerminalService.shutdown()
  cleanupDone = true
  app.quit()
})

app.on('window-all-closed', () => {
  // On macOS the app (and its live PTY host) intentionally stays running so the
  // window can be reopened with working terminals. Actual cleanup happens in
  // 'before-quit' above.
  if (process.platform !== 'darwin') app.quit()
})
