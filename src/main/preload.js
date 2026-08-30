const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('ace', {
  platform: process.platform,

  // Projects
  getProjects: () => ipcRenderer.invoke('projects:getAll'),
  addProject: (name, folderPath) => ipcRenderer.invoke('projects:add', name, folderPath),
  removeProject: (id) => ipcRenderer.invoke('projects:remove', id),
  pickFolder: (defaultPath) => ipcRenderer.invoke('projects:pickFolder', defaultPath),
  // TICKET-0057: replaces createFromTemplate (dead code -- copied from a
  // hardcoded, no-longer-existing, Windows-only template path).
  getDefaultParentDir: () => ipcRenderer.invoke('projects:getDefaultParentDir'),
  createNewProject: (name, parentDir) => ipcRenderer.invoke('projects:createNew', { name, parentDir }),

  // Agents
  getAgents: (projectId) => ipcRenderer.invoke('agents:getByProject', projectId),
  startAgent: (opts) => ipcRenderer.invoke('agents:start', opts),
  restoreAgent: (row) => ipcRenderer.invoke('agents:restore', row),
  stopAgent: (agentId) => ipcRenderer.invoke('agents:stop', agentId),
  deleteAgent: (agentId) => ipcRenderer.invoke('agents:delete', agentId),
  // TICKET-0070: auto-title -- renames the card label from the user's first
  // submitted terminal line.
  updateAgentLabel: (agentId, label) => ipcRenderer.invoke('agents:updateLabel', agentId, label),
  // TICKET-0070 (follow-up): headless call that turns a raw first line into
  // a short, meaningful title. Resolves { title: null } on any failure --
  // never rejects -- so callers can just keep their fallback title.
  generateTitle: (prompt, cwd, provider) => ipcRenderer.invoke('agents:generateTitle', { prompt, cwd, provider }),
  // TICKET-0044: record which CLI session id an agent launched with, so the
  // Token Usage "By Agent" breakdown can map tokscale sessions to agent names.
  recordAgentSession: (payload) => ipcRenderer.invoke('agents:recordSession', payload),

  // Processes
  getProcesses: () => ipcRenderer.invoke('processes:list'),

  // Token stats
  getProjectHistory: (projectId, projectPath) => ipcRenderer.invoke('tokens:getProjectHistory', { projectId, projectPath }),
  getLiveTokenUsage: () => ipcRenderer.invoke('tokens:getLiveUsage'),

  // Settings
  getSetting: (key) => ipcRenderer.invoke('settings:get', key),
  setSetting: (key, value) => ipcRenderer.invoke('settings:set', key, value),

  // File explorer / editor (TICKET-0021)
  fs: {
    readDir: (root, dirPath) => ipcRenderer.invoke('fs:readDir', { root, dirPath }),
    readFile: (root, filePath) => ipcRenderer.invoke('fs:readFile', { root, filePath }),
    writeFile: (root, filePath, content) => ipcRenderer.invoke('fs:writeFile', { root, filePath, content }),
    // TICKET-0033: file-tree right-click actions
    openInExplorer: (root, filePath) => ipcRenderer.invoke('fs:openInExplorer', { root, filePath }),
    runFile: (root, filePath) => ipcRenderer.invoke('fs:runFile', { root, filePath }),
    rename: (root, filePath, newName) => ipcRenderer.invoke('fs:rename', { root, filePath, newName }),
    trash: (root, filePath) => ipcRenderer.invoke('fs:trash', { root, filePath }),
  },

  // Screenshots (TICKET-0034, reworked from TICKET-0032)
  screenshots: {
    captureRegion: (projectPath) => ipcRenderer.invoke('screenshots:captureRegion', projectPath),
  },

  // Git operations
  git: {
    commitAndPush: (projectPath) => ipcRenderer.invoke('git:commitAndPush', { projectPath }),
    pull: (projectPath) => ipcRenderer.invoke('git:pull', { projectPath }),
  },

  // Project build (TICKET-0050)
  project: {
    build: (projectPath) => ipcRenderer.invoke('project:build', { projectPath }),
  },

  // Prerequisites (TICKET-0055): checks whether the claude/codex CLIs (and
  // the Node/npm they're installed through) are on PATH, and can install the
  // two CLIs via their official npm packages so ACE works without the user
  // manually running npm install -g themselves.
  prereqs: {
    check: () => ipcRenderer.invoke('prereqs:check'),
    install: (name) => ipcRenderer.invoke('prereqs:install', name),
    openNodeDownload: () => ipcRenderer.invoke('prereqs:openNodeDownload'),
    openGitDownload: () => ipcRenderer.invoke('prereqs:openGitDownload'),
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

  // Events from main -> renderer. AgentService emits 'agent:status' on
  // start/stop so the renderer can add or update the agent's card; the live
  // conversation itself runs in the PTY terminal (AgentTerminal.jsx), not here.
  onAgentStatus:            (cb) => ipcRenderer.on('agent:status',             (_, d) => cb(d)),
  offAgentStatus:            () => ipcRenderer.removeAllListeners('agent:status'),
})
