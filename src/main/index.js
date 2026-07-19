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

let DBService, AgentService, registerHandlers

try {
  DBService = require('./services/DBService').DBService
  AgentService = require('./services/AgentService').AgentService
  registerHandlers = require('./ipc/handlers').registerHandlers
} catch (err) {
  console.error('MODULE LOAD ERROR:', err)
  app.whenReady().then(() => {
    dialog.showErrorBox('Module Load Error', String(err?.stack || err))
  })
}

let mainWindow = null

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: '#0f1117',
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
  try {
    console.log('Initializing DBService...')
    await DBService.init()
    console.log('DBService ready. Creating window...')
    createWindow()
    AgentService.init(mainWindow)
    registerHandlers(ipcMain, mainWindow, DBService, AgentService)
    console.log('Startup complete.')
  } catch (err) {
    console.error('STARTUP ERROR:', err)
    dialog.showErrorBox('Startup Error', String(err?.stack || err))
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (AgentService) AgentService.killAll()
  if (process.platform !== 'darwin') app.quit()
})
