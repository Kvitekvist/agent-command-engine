const { app, dialog, shell } = require('electron')
const { LoadBalancer } = require('../services/LoadBalancer')
const { OptimizationAdvisor } = require('../services/OptimizationAdvisor')
const { FileService } = require('../services/FileService')
const { TokscaleService, pathToWorkspaceKey } = require('../services/TokscaleService')
const { ScreenshotService } = require('../services/ScreenshotService')

function registerHandlers(ipcMain, mainWindow, DB, AgentSvc, TerminalSvc) {
  // Keep window ref updated
  AgentSvc.setWindow(mainWindow)
  if (TerminalSvc) TerminalSvc.setWindow(mainWindow)

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

  // `defaultPath` is optional -- the "New" flow (TICKET-0057) passes ACE's
  // own parent folder (from projects:getDefaultParentDir below); the
  // "Existing" flow calls this with no arg and gets the OS's own default.
  // createDirectory lets the user make a new subfolder from inside the
  // native dialog itself, standard on both Windows and Mac.
  ipcMain.handle('projects:pickFolder', async (_, defaultPath) => {
    const opts = { properties: ['openDirectory', 'createDirectory'] }
    if (defaultPath) opts.defaultPath = defaultPath
    const result = await dialog.showOpenDialog(opts)
    if (result.canceled) return null
    return result.filePaths[0]
  })

  // TICKET-0057: "parent folder of ACE" for the New-project folder picker's
  // default location -- same isDev split main/index.js already uses for
  // loadURL vs loadFile. In dev, app.getAppPath() resolves to the repo's
  // src/ folder (where package.json lives), so its parent is the repo root
  // ("ACE" itself) and the grandparent is what we want. In a packaged
  // build, app.getAppPath() resolves inside app.asar, which isn't a
  // meaningful filesystem location to browse from -- app.getPath('exe')'s
  // directory (the install folder, or wherever a portable exe/Portable-ACE
  // was placed) is the real on-disk "ACE folder" there instead. Cross-
  // platform by construction: path.dirname/app.getAppPath/app.getPath are
  // all already OS-agnostic, no separate Windows/Mac branches needed.
  ipcMain.handle('projects:getDefaultParentDir', () => {
    try {
      const path = require('path')
      const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged
      const aceDir = isDev
        ? path.dirname(app.getAppPath())
        : path.dirname(app.getPath('exe'))
      return path.dirname(aceDir)
    } catch (_) {
      return null
    }
  })

  // TICKET-0057: replaces the old template-copy flow (createFromTemplate),
  // which copied from a hardcoded, no-longer-existing, Windows-only path --
  // dead code that could never have worked on Mac regardless. Just creates
  // an empty project folder at <parentDir>/<name>; fs.promises.mkdir is
  // already cross-platform.
  ipcMain.handle('projects:createNew', async (_, { name, parentDir } = {}) => {
    if (!name || !parentDir) return { error: 'Missing project name or location' }
    const fs = require('fs')
    const path = require('path')

    const newProjectPath = path.join(parentDir, name)
    if (fs.existsSync(newProjectPath)) {
      return { error: 'A folder with this name already exists in the selected location' }
    }
    try {
      await fs.promises.mkdir(newProjectPath, { recursive: true })
      return { path: newProjectPath }
    } catch (error) {
      return { error: error.message }
    }
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

  // TICKET-0070: renames an agent's card label -- fired once, client-side,
  // from the first line the user submits into its terminal (auto-title).
  ipcMain.handle('agents:updateLabel', (_, agentId, label) => {
    DB.updateAgentLabel(agentId, label)
    return { ok: true }
  })

  // TICKET-0070 (follow-up): one-off headless call that turns the user's
  // first submitted line into a short, meaningful title. Best-effort --
  // AgentSvc.generateTitle never rejects, it resolves null on any failure.
  ipcMain.handle('agents:generateTitle', async (_, { prompt, cwd, provider }) => {
    const title = await AgentSvc.generateTitle(prompt, cwd, provider)
    return { title }
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

  // TICKET-0044: the renderer forces a known session id per Claude agent
  // launch (`claude --session-id <uuid>`) and reports it here so the Token
  // Usage tab's "By Agent" breakdown can join tokscale's per-session rows
  // back to real agent names. Fire-and-forget from the renderer's side.
  ipcMain.handle('agents:recordSession', (_, payload) => {
    DB.recordAgentSession(payload || {})
    return { ok: true }
  })

  // Only this action may wipe a persisted conversation.
  ipcMain.handle('agents:clearContext', (_, agentId) => {
    const result = AgentSvc.clearContext(agentId)
    DB.clearAgentHistory(agentId)
    return result
  })

  // Track each process invocation independently. Keying by execution rather
  // than agent prevents an old close event from completing a newer prompt.
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
    const result = AgentSvc.sendPrompt(agentId, prompt)
    if (result.error) {
      DB.updatePromptTokens(promptId, {
        response_text: result.error,
        input_tokens: 0,
        output_tokens: 0,
        duration_ms: Date.now() - startedAt,
      })
      return result
    }
    inFlight.set(result.executionId, { promptId, startedAt })
    return result
  })

  // When a prompt completes, update the DB row with the fast stdout-parsed
  // token counts + response. Kept in `inFlight` a while longer (instead of
  // deleting here) so the async 'agent:tokens-reconciled' correction below
  // — which lands a moment later, once tokscale resolves — still has the
  // promptId to apply itself to.
  AgentSvc.on('agent:prompt-done', (data) => {
    if (data.sessionId) {
      DB.updateAgentSession(data.agentId, data.sessionId)
    }
    const flight = inFlight.get(data.executionId)
    if (!flight || flight.promptId == null) return
    DB.updatePromptTokens(flight.promptId, {
      response_text: data.response || data.error || null,
      input_tokens: data.tokens?.input || 0,
      output_tokens: data.tokens?.output || 0,
      duration_ms: Date.now() - flight.startedAt,
    })
    // Reconciliation either lands or is skipped (e.g. codex, tokscale
    // unavailable) well within this window; whichever happens first, the
    // entry must not leak for the lifetime of the app.
    setTimeout(() => inFlight.delete(data.executionId), 30_000)
  })

  // Corrects a prompt row's token/cost columns once TokscaleService's
  // reconciliation resolves (see AgentService._reconcileTokens). Never fires
  // for codex — it has no stable session id to reconcile against.
  AgentSvc.on('agent:tokens-reconciled', (data) => {
    const flight = inFlight.get(data.executionId)
    if (!flight || flight.promptId == null) return
    DB.updatePromptUsage(flight.promptId, {
      input_tokens: data.tokens.input,
      output_tokens: data.tokens.output,
      cache_read_tokens: data.tokens.cacheRead,
      cache_creation_tokens: data.tokens.cacheCreation,
      cost_usd: data.costUsd,
    })
  })

  // ── Audit log ───────────────────────────────────────────────────────────────
  ipcMain.handle('prompts:get', (_, filters) => DB.getPrompts(filters || {}))
  ipcMain.handle('prompts:getById', (_, id) => DB.getPromptById(id))

  // ── Token stats ─────────────────────────────────────────────────────────────
  ipcMain.handle('tokens:getStats', (_, filters) => DB.getTokenStats(filters || {}))

  // TICKET-0044: "History (this project)" — real per-session usage for the
  // active project, straight from tokscale (the `prompts` table this used to
  // read has been dead since TICKET-0019). Rows are scoped to the project's
  // workspace key, then annotated with the ACE agent that owns each session
  // (via agent_sessions) so the renderer can build Totals / By Day / By Model /
  // By Agent without any per-model or per-day tokscale calls. Sessions with no
  // recorded owner (Codex, or anything from before this shipped) are labelled
  // "Untracked". Returns a normalized, flat row list; the renderer aggregates.
  ipcMain.handle('tokens:getProjectHistory', async (_, { projectId, projectPath } = {}) => {
    if (!projectPath) return { rows: [] }
    const workspaceKey = pathToWorkspaceKey(projectPath)
    const sessionRows = await TokscaleService.getWorkspaceReport(workspaceKey, ['claude', 'codex'])
    const ownerMap = projectId ? DB.getAgentSessionMap(projectId) : {}

    const rows = sessionRows.map((r) => {
      const owner = ownerMap[r.session_id]
      // created_at is epoch ms; bucket by its local calendar day (YYYY-MM-DD).
      const day = r.created_at ? new Date(r.created_at).toLocaleDateString('en-CA') : 'unknown'
      const models = Array.isArray(r.models_used) && r.models_used.length ? r.models_used : ['unknown']
      return {
        sessionId: r.session_id,
        client: r.client,
        day,
        // A session is almost always one model; join the rare multi-model case
        // rather than misattribute its tokens to just one of them.
        model: models.join(', '),
        input: Number(r.total_input_tokens) || 0,
        output: Number(r.total_output_tokens) || 0,
        cacheRead: Number(r.total_cache_read) || 0,
        cost: Number(r.total_cost) || 0,
        prompts: Number(r.message_count) || 0,
        agentLabel: owner?.label || 'Untracked',
      }
    })
    return { rows }
  })

  // Live usage dashboard (TICKET-0022) -- sourced straight from tokscale
  // (real subscription quota + today's session transcripts), independent
  // of ACE's own `prompts` table, which the embedded terminal (TICKET-0019)
  // no longer populates. Quota and today's breakdown are fetched
  // independently so one provider being logged out, or one call failing,
  // doesn't blank out the other.
  ipcMain.handle('tokens:getLiveUsage', async () => {
    const clients = ['claude', 'codex']
    const result = {}
    for (const c of clients) result[c] = { plan: null, quota: [], models: [], projects: [], totalTokens: 0 }

    try {
      const quota = await TokscaleService.getQuota()
      for (const entry of quota || []) {
        const key = (entry.provider || '').toLowerCase()
        if (result[key]) {
          result[key].plan = entry.plan || null
          result[key].quota = entry.metrics || []
        }
      }
    } catch (error) {
      for (const c of clients) result[c].quotaError = error.message
    }

    try {
      const breakdown = await TokscaleService.getTodayBreakdown(clients)
      for (const c of clients) {
        if (breakdown[c]) {
          result[c].models = breakdown[c].models
          result[c].projects = breakdown[c].projects
          result[c].totalTokens = breakdown[c].totalTokens
        }
      }
    } catch (error) {
      for (const c of clients) result[c].breakdownError = error.message
    }

    return result
  })

  // ── Settings ────────────────────────────────────────────────────────────────
  ipcMain.handle('settings:get', (_, key) => DB.getSetting(key))
  ipcMain.handle('settings:set', (_, key, value) => {
    DB.setSetting(key, value)
    return { ok: true }
  })

  // ── Optimization advisor ────────────────────────────────────────────────────
  ipcMain.handle('optimize:analyze', (_, projectId) => OptimizationAdvisor.analyze(projectId))

  // ── File explorer / editor (TICKET-0021) ────────────────────────────────────
  // `root` is always the requesting project's path (as the renderer already
  // knows it) -- FileService refuses any resolved path that falls outside it.
  ipcMain.handle('fs:readDir', (_, { root, dirPath }) => {
    try {
      return { ok: true, entries: FileService.readDir(root, dirPath) }
    } catch (error) {
      return { ok: false, error: error.message }
    }
  })

  ipcMain.handle('fs:readFile', (_, { root, filePath }) => {
    try {
      return FileService.readFile(root, filePath)
    } catch (error) {
      return { ok: false, error: error.message }
    }
  })

  ipcMain.handle('fs:writeFile', (_, { root, filePath, content }) => {
    try {
      return FileService.writeFile(root, filePath, content)
    } catch (error) {
      return { ok: false, error: error.message }
    }
  })

  // TICKET-0033: file-tree right-click actions
  ipcMain.handle('fs:openInExplorer', (_, { root, filePath }) => {
    try {
      return FileService.openInExplorer(root, filePath)
    } catch (error) {
      return { ok: false, error: error.message }
    }
  })

  ipcMain.handle('fs:runFile', (_, { root, filePath }) => {
    try {
      return FileService.runFile(root, filePath)
    } catch (error) {
      return { ok: false, error: error.message }
    }
  })

  // ── Screenshots (TICKET-0034, reworked from TICKET-0032) ───────────────────
  // Drag-to-select screen capture, saved into the requesting project's own
  // .ace/screenshots/ folder -- see ScreenshotService for the capture-overlay
  // flow and the clipboard-path handoff.
  ipcMain.handle('screenshots:captureRegion', async (_, projectPath) => {
    try {
      return await ScreenshotService.captureRegion(projectPath)
    } catch (error) {
      return { ok: false, error: error.message }
    }
  })

  // ── Git operations ──────────────────────────────────────────────────────────
  ipcMain.handle('git:commitAndPush', async (_, { projectPath } = {}) => {
    if (!projectPath) return { ok: false, error: 'No project path' }
    const { spawn } = require('child_process')
    const path = require('path')

    try {
      // Helper to run git command. NOTE: no `shell: true` -- with a shell,
      // spawn re-joins argv into one string and cmd.exe re-splits it on spaces,
      // so a multi-word arg like the commit message ("Quick commit from ACE")
      // fragments and git reads "commit"/"from"/"ACE" as pathspecs. git is
      // git.exe (found on PATH without a shell; libuv auto-appends .exe), so
      // shell:false both works and keeps each argv element intact.
      const runGit = (args) => new Promise((resolve, reject) => {
        const proc = spawn('git', args, {
          cwd: projectPath,
          windowsHide: true,
        })
        let stdout = ''
        let stderr = ''
        proc.stdout?.on('data', d => stdout += d)
        proc.stderr?.on('data', d => stderr += d)
        proc.on('error', err => reject(err))
        proc.on('close', code => {
          if (code === 0) resolve(stdout)
          else reject(new Error(stderr || `git exited with code ${code}`))
        })
      })

      // Check status
      const status = await runGit(['status', '--porcelain'])
      if (!status.trim()) {
        return { ok: true, message: 'No changes to commit' }
      }

      // Stage all changes
      try {
        await runGit(['add', '-A'])
      } catch (error) {
        return { ok: false, error: `Stage failed: ${error.message}` }
      }

      // Commit
      const commitMsg = 'Quick commit from ACE\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>'
      try {
        await runGit(['commit', '-m', commitMsg])
      } catch (error) {
        return { ok: false, error: `Commit failed: ${error.message}` }
      }

      // Push - explicitly verify it succeeds
      try {
        await runGit(['push'])
      } catch (error) {
        return { ok: false, error: `Push failed: ${error.message}` }
      }

      // Verify push succeeded by checking remote tracking
      const verifyResult = await runGit(['rev-list', '@{u}..HEAD', '--count'])
      const unpushedCount = parseInt(verifyResult.trim(), 10)
      if (unpushedCount > 0) {
        return { ok: false, error: `Verification failed - ${unpushedCount} commit(s) still unpushed` }
      }

      return { ok: true, message: 'Committed and pushed successfully ✓' }
    } catch (error) {
      return { ok: false, error: error.message }
    }
  })

  ipcMain.handle('git:pull', async (_, { projectPath } = {}) => {
    if (!projectPath) return { ok: false, error: 'No project path' }
    const { spawn } = require('child_process')

    try {
      // No `shell: true` -- see the note in git:commitAndPush above.
      const proc = spawn('git', ['pull'], {
        cwd: projectPath,
        windowsHide: true,
      })

      let stdout = ''
      let stderr = ''
      proc.stdout?.on('data', d => stdout += d)
      proc.stderr?.on('data', d => stderr += d)

      return new Promise((resolve) => {
        proc.on('error', err => resolve({ ok: false, error: err.message }))
        proc.on('close', code => {
          if (code === 0) {
            resolve({ ok: true, message: stdout || 'Pulled successfully' })
          } else {
            resolve({ ok: false, error: stderr || `git pull exited with code ${code}` })
          }
        })
      })
    } catch (error) {
      return { ok: false, error: error.message }
    }
  })

  // ── Project build (TICKET-0050) ──────────────────────────────────────────────
  // Runs the project's own build script (prefers `build`, falls back to
  // `package`) in whichever directory actually holds a package.json with one --
  // ACE keeps its package.json under src/ (see project_memory.md Technical
  // Debt), so a plain `<projectPath>/package.json` check would miss it. Returns
  // one settled result the renderer turns into a success/fail line; the last few
  // lines of npm output are surfaced on failure so the error is actionable
  // without opening a terminal.
  ipcMain.handle('project:build', async (_, { projectPath } = {}) => {
    if (!projectPath) return { ok: false, error: 'No project path' }
    const { spawn } = require('child_process')
    const fs = require('fs')
    const path = require('path')

    // src/ first (ACE's own layout), then the project root.
    let cwd = null
    let script = null
    for (const dir of [path.join(projectPath, 'src'), projectPath]) {
      const pkgPath = path.join(dir, 'package.json')
      if (!fs.existsSync(pkgPath)) continue
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
        if (pkg.scripts?.build) { cwd = dir; script = 'build'; break }
        if (pkg.scripts?.package) { cwd = dir; script = 'package'; break }
      } catch (_) { /* unreadable/invalid package.json -- keep looking */ }
    }
    if (!cwd) return { ok: false, error: 'No build/package script found in package.json' }

    try {
      const result = await new Promise((resolve) => {
        const proc = spawn('npm', ['run', script], {
          cwd,
          windowsHide: true,
          shell: true,
        })
        let stdout = ''
        let stderr = ''
        proc.stdout?.on('data', d => stdout += d)
        proc.stderr?.on('data', d => stderr += d)
        proc.on('close', code => resolve({ code, stdout, stderr }))
        proc.on('error', err => resolve({ code: -1, stderr: err.message }))
      })
      if (result.code === 0) {
        return { ok: true, message: `Build complete (npm run ${script})` }
      }
      const tail = (result.stderr || result.stdout || '')
        .split('\n').filter(Boolean).slice(-5).join('\n')
      return { ok: false, error: tail || `Build exited with code ${result.code}` }
    } catch (error) {
      return { ok: false, error: error.message }
    }
  })

  // ── Prerequisites (TICKET-0055) ─────────────────────────────────────────────
  // ACE spawns the real `claude`/`codex` CLIs directly (AgentService.js,
  // agentLaunch.js), so a fresh machine without them on PATH just fails every
  // agent launch with no useful guidance. Checks presence/version of node,
  // npm, and both CLIs, and can install the CLIs via their official npm
  // packages -- confirmed against this project's own working install via
  // `npm ls -g` (@anthropic-ai/claude-code, @openai/codex). Deliberately does
  // NOT attempt to install Node.js itself (see prereqs:openNodeDownload) --
  // that's a much bigger system change than two CLI packages, so the setup
  // UI links out and lets the user handle it, the same as any other
  // dev-tool prerequisite.
  const PREREQ_PACKAGES = {
    claude: '@anthropic-ai/claude-code',
    codex: '@openai/codex',
  }

  ipcMain.handle('prereqs:check', async () => {
    const { spawn } = require('child_process')
    // node/git resolve to real .exe's on Windows (shell:false, same reasoning
    // as git:commitAndPush above); npm/claude/codex are .cmd shims there and
    // need a shell to run at all (same convention as project:build's `npm run`
    // and AgentService.js's `spawn(provider, args, {shell: win32})`).
    const checks = [
      { name: 'node', cmd: 'node', args: ['--version'], shell: false },
      { name: 'npm', cmd: 'npm', args: ['--version'], shell: true },
      { name: 'claude', cmd: 'claude', args: ['--version'], shell: process.platform === 'win32' },
      { name: 'codex', cmd: 'codex', args: ['--version'], shell: process.platform === 'win32' },
    ]
    const results = {}
    await Promise.all(checks.map(({ name, cmd, args, shell: useShell }) => new Promise((resolve) => {
      let stdout = ''
      const proc = spawn(cmd, args, { windowsHide: true, shell: useShell })
      proc.stdout?.on('data', (d) => { stdout += d })
      proc.on('error', () => { results[name] = { present: false, version: null }; resolve() })
      proc.on('close', (code) => {
        results[name] = code === 0
          ? { present: true, version: stdout.trim().replace(/^v/, '') }
          : { present: false, version: null }
        resolve()
      })
    })))
    return results
  })

  ipcMain.handle('prereqs:install', async (_, name) => {
    const pkg = PREREQ_PACKAGES[name]
    if (!pkg) return { ok: false, error: `Unknown prerequisite "${name}"` }
    const { spawn } = require('child_process')

    return new Promise((resolve) => {
      const proc = spawn('npm', ['install', '-g', pkg], { windowsHide: true, shell: true })
      let stdout = ''
      let stderr = ''
      proc.stdout?.on('data', (d) => { stdout += d })
      proc.stderr?.on('data', (d) => { stderr += d })
      proc.on('error', (err) => resolve({ ok: false, error: err.message }))
      proc.on('close', (code) => {
        if (code === 0) {
          resolve({ ok: true, message: `${pkg} installed` })
          return
        }
        const raw = stderr || stdout || ''
        const tail = raw.split('\n').filter(Boolean).slice(-5).join('\n')
        const eaccesHint = /EACCES|permission denied/i.test(raw)
          ? `\n\nThis looks like an npm permissions issue, common on macOS when npm's global folder needs sudo. Try running "sudo npm install -g ${pkg}" in a terminal, or see https://docs.npmjs.com/resolving-eacces-permissions-errors-when-installing-packages-globally`
          : ''
        resolve({ ok: false, error: (tail || `npm install exited with code ${code}`) + eaccesHint })
      })
    })
  })

  ipcMain.handle('prereqs:openNodeDownload', () => {
    shell.openExternal('https://nodejs.org')
    return { ok: true }
  })

  // ── Terminal (TICKET-0019) ──────────────────────────────────────────────────
  // Keystrokes/resize/dispose are fire-and-forget (ipcMain.on) -- there's no
  // meaningful single response to a keystroke. Spawn is the one call with a
  // real result (did it start, what's its id/pid), so it's the one invoke().
  ipcMain.handle('terminal:spawn', (_, opts) => TerminalSvc.spawn(opts))
  ipcMain.on('terminal:write', (_, { id, data } = {}) => TerminalSvc.write(id, data))
  ipcMain.on('terminal:resize', (_, { id, cols, rows } = {}) => TerminalSvc.resize(id, cols, rows))
  ipcMain.on('terminal:dispose', (_, { id } = {}) => TerminalSvc.dispose(id))
  ipcMain.on('terminal:setAutoAnswer', (_, { id, enabled } = {}) => TerminalSvc.setAutoAnswer(id, enabled))
}

module.exports = { registerHandlers }
