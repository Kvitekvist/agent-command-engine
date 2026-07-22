const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('cpi', {
  // Projects
  getProjects: () => ipcRenderer.invoke('projects:getAll'),
  addProject: (name, folderPath) => ipcRenderer.invoke('projects:add', name, folderPath),
  removeProject: (id) => ipcRenderer.invoke('projects:remove', id),
  pickFolder: () => ipcRenderer.invoke('projects:pickFolder'),

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

  // Settings
  getSetting: (key) => ipcRenderer.invoke('settings:get', key),
  setSetting: (key, value) => ipcRenderer.invoke('settings:set', key, value),

  // Optimization advisor
  getOptimizationAdvice: (projectId) => ipcRenderer.invoke('optimize:analyze', projectId),

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
