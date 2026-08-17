const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')

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

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

// Icon path - works for both dev and packaged builds
const getIconPath = () => {
  if (process.platform === 'win32') {
    return path.join(__dirname, '../../build/icon.ico')
  } else if (process.platform === 'darwin') {
    // macOS uses .icns, but Electron sets it automatically from the app bundle
    return path.join(__dirname, '../../build/icon.icns')
  }
  return undefined
}

// Single-instance lock (TICKET-0043). Without this, nothing stops a second
// ACE launch from opening a competing window. When more than one window is
// open, Windows routes keyboard input to whichever window holds OS focus —
// not necessarily the one the user is clicking in — so keystrokes aimed at
// the front window (e.g. the transient "new project" name field) silently
// land in a different ACE window. It also means two instances write the
// same on-disk cpi.db (DBService rewrites the whole file on every write),
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
    },
  })

  if (isDev) {
    const devUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173'
    console.log('Loading dev URL:', devUrl)
    mainWindow.loadURL(devUrl)
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(app.getAppPath(), 'dist/renderer/index.html'))
  }

  mainWindow.on('closed', () => { mainWindow = null })
}

app.whenReady().then(async () => {
  // Lost the single-instance lock — the first instance is already running
  // (and has been focused via 'second-instance' above). Do nothing here so
  // this process never creates a window or opens cpi.db before app.quit().
  if (!gotTheLock) return
  try {
    console.log('Initializing DBService...')
    await DBService.init()
    console.log('DBService ready. Creating window...')
    createWindow()
    AgentService.init(mainWindow)
    TerminalService.init(mainWindow)
    registerHandlers(ipcMain, mainWindow, DBService, AgentService, TerminalService)
    console.log('Startup complete.')
  } catch (err) {
    console.error('STARTUP ERROR:', err)
    dialog.showErrorBox('Startup Error', String(err?.stack || err))
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', async () => {
  if (AgentService) AgentService.killAll()
  if (TerminalService) await TerminalService.shutdown()
  if (process.platform !== 'darwin') app.quit()
})
