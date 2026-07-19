const { dialog } = require('electron')
const { LoadBalancer } = require('../services/LoadBalancer')
const { OptimizationAdvisor } = require('../services/OptimizationAdvisor')

function registerHandlers(ipcMain, mainWindow, DB, AgentSvc) {
  // Keep window ref updated
  AgentSvc.setWindow(mainWindow)

  // ── Projects ────────────────────────────────────────────────────────────────
  ipcMain.handle('projects:getAll', () => DB.getProjects())

  ipcMain.handle('projects:add', (_, name, folderPath) => {
    DB.addProject(name, folderPath)
    return DB.getProjects()
  })

  ipcMain.handle('projects:remove', (_, id) => {
    DB.removeProject(id)
    return DB.getProjects()
  })

  ipcMain.handle('projects:pickFolder', async () => {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory'] })
    if (result.canceled) return null
    return result.filePaths[0]
  })

  // ── Agents ──────────────────────────────────────────────────────────────────
  ipcMain.handle('agents:getByProject', (_, projectId) => {
    return DB.getAgentsByProject(projectId)
  })

  ipcMain.handle('agents:start', (_, { projectId, projectPath, label, provider, model }) => {
    const resolvedProvider = LoadBalancer.decide({ manualProvider: provider, projectId })
    const result = AgentSvc.start({ projectId, projectPath, label, provider: resolvedProvider, model })
    DB.upsertAgent({
      id: result.agentId,
      project_id: projectId,
      label,
      provider: resolvedProvider,
      model,
      status: 'running',
    })
    return result
  })

  ipcMain.handle('agents:stop', (_, agentId) => {
    AgentSvc.stop(agentId)
    DB.updateAgentStatus(agentId, 'stopped')
    return { ok: true }
  })

  ipcMain.handle('agents:sendPrompt', async (_, agentId, prompt) => {
    const agent = AgentSvc.agents.get(agentId)
    if (!agent) return { error: 'Agent not found' }

    const startedAt = Date.now()
    const result = AgentSvc.sendPrompt(agentId, prompt)

    // Log the prompt immediately; response will be streamed via agent:output events
    DB.logPrompt({
      agent_id: agentId,
      project_id: agent.meta.projectId,
      task_label: agent.meta.label,
      prompt_text: prompt,
      response_text: null,
      provider: agent.meta.provider,
      model: agent.meta.model,
      input_tokens: 0,
      output_tokens: 0,
      duration_ms: Date.now() - startedAt,
    })

    return result
  })

  // ── Audit log ───────────────────────────────────────────────────────────────
  ipcMain.handle('prompts:get', (_, filters) => DB.getPrompts(filters || {}))
  ipcMain.handle('prompts:getById', (_, id) => DB.getPromptById(id))

  // ── Token stats ─────────────────────────────────────────────────────────────
  ipcMain.handle('tokens:getStats', (_, filters) => DB.getTokenStats(filters || {}))

  // ── Settings ────────────────────────────────────────────────────────────────
  ipcMain.handle('settings:get', (_, key) => DB.getSetting(key))
  ipcMain.handle('settings:set', (_, key, value) => {
    DB.setSetting(key, value)
    return { ok: true }
  })

  // ── Optimization advisor ────────────────────────────────────────────────────
  ipcMain.handle('optimize:analyze', (_, projectId) => OptimizationAdvisor.analyze(projectId))
}

module.exports = { registerHandlers }
