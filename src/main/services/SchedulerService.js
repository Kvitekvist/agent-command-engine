// Project-level "run the open tasks automatically" trigger (TICKET-0172).
// One schedule per project, stored at .ace/schedule.json:
//   { nextRunAt: ISOString | null, intervalMinutes: number | null }
// On fire, reads .ace/tasks.txt (via TasksService) and, if anything is
// still open, launches a brand-new autonomous Claude agent and auto-submits
// the open tasks as its first prompt -- see HookService.registerAutoPrompt
// for how that prompt gets typed in without any renderer/UI involvement.
const fs = require('node:fs')
const path = require('node:path')
const { randomUUID } = require('node:crypto')
const { resolveWithinRoot } = require('./ProjectPath')
const { resolveLaunchPolicy } = require('./LaunchPolicy')
const { providerExecutable } = require('./ProviderExecutable')
const { tasksOperation } = require('./TasksService')
const { registerAutoPrompt } = require('./HookService')
const { ensureBundledSkills, getScaffoldDir } = require('./ProjectScaffoldService')

const SCHEDULE = '.ace/schedule.json'

function readSchedule(root) {
  try {
    const data = JSON.parse(fs.readFileSync(resolveWithinRoot(root, SCHEDULE), 'utf8'))
    return { nextRunAt: data.nextRunAt || null, intervalMinutes: data.intervalMinutes || null }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
    return { nextRunAt: null, intervalMinutes: null }
  }
}

function writeSchedule(root, schedule) {
  const target = resolveWithinRoot(root, SCHEDULE)
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.writeFileSync(target, JSON.stringify(schedule), 'utf8')
}

function buildPrompt(tasks) {
  return 'You were started automatically by a scheduled trigger. Work through these open tasks for this project, one at a time:\n\n' +
    tasks.map((task, i) => `${i + 1}. ${task.text}`).join('\n')
}

class SchedulerService {
  constructor({ DB, AgentSvc, TerminalSvc, hookSettingsPath }) {
    this.DB = DB
    this.AgentSvc = AgentSvc
    this.TerminalSvc = TerminalSvc
    this.hookSettingsPath = hookSettingsPath
    this.timers = new Map() // root -> Timeout
  }

  read(root) { return readSchedule(root) }

  set(root, projectId, { delayMinutes, intervalMinutes } = {}) {
    if (!Number.isFinite(delayMinutes) || delayMinutes < 1) throw new Error('Delay must be at least 1 minute')
    if (intervalMinutes != null && (!Number.isFinite(intervalMinutes) || intervalMinutes < 1)) {
      throw new Error('Repeat interval must be at least 1 minute')
    }
    const schedule = { nextRunAt: new Date(Date.now() + delayMinutes * 60000).toISOString(), intervalMinutes: intervalMinutes || null }
    writeSchedule(root, schedule)
    this.arm(root, projectId)
    return schedule
  }

  cancel(root) {
    writeSchedule(root, { nextRunAt: null, intervalMinutes: null })
    clearTimeout(this.timers.get(root))
    this.timers.delete(root)
  }

  arm(root, projectId) {
    clearTimeout(this.timers.get(root))
    this.timers.delete(root)
    const schedule = readSchedule(root)
    if (!schedule.nextRunAt) return
    const delay = Math.max(0, new Date(schedule.nextRunAt).getTime() - Date.now())
    this.timers.set(root, setTimeout(() => this.fire(root, projectId), delay))
  }

  armAll(projects) {
    for (const project of projects) {
      let root
      try { root = fs.realpathSync.native(project.path) } catch (_) { continue }
      this.arm(root, project.id)
    }
  }

  async fire(root, projectId) {
    this.timers.delete(root)
    const schedule = readSchedule(root)
    try {
      const { tasks } = await tasksOperation(root)
      const open = tasks.filter(task => !task.done)
      if (open.length) await this.launch(projectId, root, buildPrompt(open))
    } catch (error) { console.error('Scheduled agent launch failed:', error) }
    if (schedule.intervalMinutes) {
      writeSchedule(root, { nextRunAt: new Date(Date.now() + schedule.intervalMinutes * 60000).toISOString(), intervalMinutes: schedule.intervalMinutes })
      this.arm(root, projectId)
    } else {
      writeSchedule(root, { nextRunAt: null, intervalMinutes: null })
    }
  }

  async launch(projectId, projectPath, prompt) {
    const launch = resolveLaunchPolicy({ provider: 'claude', projectId }, { getSetting: key => this.DB.getSetting(key) })
    const { agentId } = this.AgentSvc.start({
      projectId, projectPath, label: 'Scheduled tasks',
      provider: launch.provider, model: launch.model, permissionMode: 'auto',
    })
    this.DB.upsertAgent({
      id: agentId, project_id: projectId, agent_name: 'Scheduled tasks', session_title: null,
      provider: launch.provider, model: launch.model, status: 'running', permission_mode: 'auto',
    })
    registerAutoPrompt(agentId, prompt)
    try { ensureBundledSkills(projectPath, getScaffoldDir()) } catch (_) {}
    const { buildLaunchCommand } = await import('./agentLaunch.mjs')
    const sessionId = randomUUID()
    const command = buildLaunchCommand(
      { provider: launch.provider, model: launch.model, permissionMode: 'auto' },
      sessionId, this.hookSettingsPath, process.platform, providerExecutable(launch.provider), false,
    )
    const shell = process.platform === 'win32' ? 'powershell.exe' : '/bin/bash'
    const result = await this.TerminalSvc.spawn({ agentId, cwd: projectPath, shell, cols: 80, rows: 24, command })
    if (result.success) {
      const agent = this.AgentSvc.agents.get(agentId)
      if (agent) agent.sessionId = sessionId
      this.DB.recordAgentSession({ session_id: sessionId, agent_id: agentId, project_id: projectId, agent_name: 'Scheduled tasks' })
    }
    return result
  }
}

module.exports = { SchedulerService }
