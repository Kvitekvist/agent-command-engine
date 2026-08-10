const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('cpi', {
  platform: process.platform,

  // Projects
  getProjects: () => ipcRenderer.invoke('projects:getAll'),
  addProject: (name, folderPath) => ipcRenderer.invoke('projects:add', name, folderPath),
  removeProject: (id) => ipcRenderer.invoke('projects:remove', id),
  pickFolder: () => ipcRenderer.invoke('projects:pickFolder'),
  createFromTemplate: (projectName) => ipcRenderer.invoke('projects:createFromTemplate', projectName),

  // Agents
  getAgents: (projectId) => ipcRenderer.invoke('agents:getByProject', projectId),
  startAgent: (opts) => ipcRenderer.invoke('agents:start', opts),
  restoreAgent: (row) => ipcRenderer.invoke('agents:restore', row),
  stopAgent: (agentId) => ipcRenderer.invoke('agents:stop', agentId),
  deleteAgent: (agentId) => ipcRenderer.invoke('agents:delete', agentId),
  clearContext: (agentId) => ipcRenderer.invoke('agents:clearContext', agentId),
  sendPrompt: (agentId, prompt) => ipcRenderer.invoke('agents:sendPrompt', agentId, prompt),

  // Audit log
  getPrompts: (filters) => ipcRenderer.invoke('prompts:get', filters),
  getPromptById: (id) => ipcRenderer.invoke('prompts:getById', id),

  // Token stats
  getTokenStats: (filters) => ipcRenderer.invoke('tokens:getStats', filters),
  getLiveTokenUsage: () => ipcRenderer.invoke('tokens:getLiveUsage'),

  // Settings
  getSetting: (key) => ipcRenderer.invoke('settings:get', key),
  setSetting: (key, value) => ipcRenderer.invoke('settings:set', key, value),

  // Optimization advisor
  getOptimizationAdvice: (projectId) => ipcRenderer.invoke('optimize:analyze', projectId),

  // File explorer / editor (TICKET-0021)
  fs: {
    readDir: (root, dirPath) => ipcRenderer.invoke('fs:readDir', { root, dirPath }),
    readFile: (root, filePath) => ipcRenderer.invoke('fs:readFile', { root, filePath }),
    writeFile: (root, filePath, content) => ipcRenderer.invoke('fs:writeFile', { root, filePath, content }),
    // TICKET-0033: file-tree right-click actions
    openInExplorer: (root, filePath) => ipcRenderer.invoke('fs:openInExplorer', { root, filePath }),
    runFile: (root, filePath) => ipcRenderer.invoke('fs:runFile', { root, filePath }),
  },

  // Screenshots (TICKET-0034, reworked from TICKET-0032)
  screenshots: {
    captureRegion: (projectPath) => ipcRenderer.invoke('screenshots:captureRegion', projectPath),
  },

  // Terminal
  terminal: {
    spawn: (opts) => ipcRenderer.invoke('terminal:spawn', opts),
    write: (id, data) => ipcRenderer.send('terminal:write', { id, data }),
    resize: (id, cols, rows) => ipcRenderer.send('terminal:resize', { id, cols, rows }),
    dispose: (id) => ipcRenderer.send('terminal:dispose', { id }),
    setAutoAnswer: (id, enabled) => ipcRenderer.send('terminal:setAutoAnswer', { id, enabled }),
    onData: (cb) => {
      const handler = (_, d) => cb(d)
      ipcRenderer.on('terminal:data', handler)
      return () => ipcRenderer.removeListener('terminal:data', handler)
    },
    onExit: (cb) => {
      const handler = (_, d) => cb(d)
      ipcRenderer.on('terminal:exit', handler)
      return () => ipcRenderer.removeListener('terminal:exit', handler)
    },
    onHostRestarted: (cb) => {
      ipcRenderer.on('terminal:hostRestarted', cb)
      return () => ipcRenderer.removeListener('terminal:hostRestarted', cb)
    },
  },

  // Events from main -> renderer
  onAgentOutput:            (cb) => ipcRenderer.on('agent:output',             (_, d) => cb(d)),
  onAgentStatus:            (cb) => ipcRenderer.on('agent:status',             (_, d) => cb(d)),
  onAgentPromptDone:        (cb) => ipcRenderer.on('agent:prompt-done',        (_, d) => cb(d)),
  onAgentToolUse:           (cb) => ipcRenderer.on('agent:tool-use',           (_, d) => cb(d)),

  offAgentOutput:            () => ipcRenderer.removeAllListeners('agent:output'),
  offAgentStatus:            () => ipcRenderer.removeAllListeners('agent:status'),
  offAgentPromptDone:        () => ipcRenderer.removeAllListeners('agent:prompt-done'),
  offAgentToolUse:           () => ipcRenderer.removeAllListeners('agent:tool-use'),
})
