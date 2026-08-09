const { contextBridge, ipcRenderer } = require('electron')

// Minimal bridge for the screenshot capture overlay (TICKET-0034) --
// mirrors src/main/preload.js's contextBridge pattern rather than enabling
// nodeIntegration, so the overlay page has no direct Node/IPC access.
contextBridge.exposeInMainWorld('overlay', {
  onImage: (cb) => ipcRenderer.on('screenshot-overlay:image', (_, dataUrl) => cb(dataUrl)),
  selected: (rect) => ipcRenderer.send('screenshot-overlay:selected', rect),
  cancelled: () => ipcRenderer.send('screenshot-overlay:cancelled'),
})
