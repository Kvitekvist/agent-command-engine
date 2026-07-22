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

  ipcMain.handle('agents:start', (_, { projectId, projectPath, label, provider, model, permissionMode }) => {
    const resolvedProvider = LoadBalancer.decide({ manualProvider: provider, projectId })
    const resolvedMode = permissionMode || 'safe'
    const result = AgentSvc.start({ projectId, projectPath, label, provider: resolvedProvider, model, permissionMode: resolvedMode })
    DB.upsertAgent({
      id: result.agentId,
      project_id: projectId,
      label,
      provider: resolvedProvider,
      model,
      status: 'running',
      permission_mode: resolvedMode,
    })
    return result
  })

  // Re-register agents persisted from a previous run (app reopened, or the
  // project was reselected) so their history + session can be resumed.
  ipcMain.handle('agents:restore', (_, { id, project_id, projectPath, label, provider, model, permission_mode, session_id }) => {
    return AgentSvc.restore({
      agentId: id,
      projectId: project_id,
      projectPath,
      label,
      provider,
      model,
      permissionMode: permission_mode,
      sessionId: session_id,
    })
  })

  ipcMain.handle('agents:stop', (_, agentId) => {
    AgentSvc.stop(agentId)
    DB.updateAgentStatus(agentId, 'stopped')
    return { ok: true }
  })

  // Removes an agent from the interface entirely. Stops the process first
  // (no-op if it's already stopped) so a delete can never orphan a subprocess.
  ipcMain.handle('agents:delete', (_, agentId) => {
    AgentSvc.stop(agentId)
    DB.deleteAgent(agentId)
    return { ok: true }
  })

  // Only this action may wipe a persisted conversation.
  ipcMain.handle('agents:clearContext', (_, agentId) => {
    const result = AgentSvc.clearContext(agentId)
    DB.clearAgentHistory(agentId)
    return result
  })

  // Track in-flight prompts: agentId -> { promptId, startedAt }
  const inFlight = new Map()

  ipcMain.handle('agents:sendPrompt', async (_, agentId, prompt) => {
    const agent = AgentSvc.agents.get(agentId)
    if (!agent) return { error: 'Agent not found' }

    const startedAt = Date.now()

    // Log prompt row immediately with zero tokens — updated on completion
    const promptId = DB.logPrompt({
      agent_id: agentId,
      project_id: agent.meta.projectId,
      task_label: agent.meta.label,
      prompt_text: prompt,
      response_text: null,
      provider: agent.meta.provider,
      model: agent.meta.model,
      input_tokens: 0,
      output_tokens: 0,
      duration_ms: 0,
    })
    inFlight.set(agentId, { promptId, startedAt })

    const result = AgentSvc.sendPrompt(agentId, prompt)
    return result
  })

  // When a prompt completes, update the DB row with real token counts + response
  AgentSvc.on('agent:prompt-done', (data) => {
    if (data.sessionId) {
      DB.updateAgentSession(data.agentId, data.sessionId)
    }
    const flight = inFlight.get(data.agentId)
    if (!flight || flight.promptId == null) return
    inFlight.delete(data.agentId)
    DB.updatePromptTokens(flight.promptId, {
      response_text: data.response || null,
      input_tokens: data.tokens?.input || 0,
      output_tokens: data.tokens?.output || 0,
      duration_ms: Date.now() - flight.startedAt,
    })
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
