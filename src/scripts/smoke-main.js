// Hidden, isolated exercise of ACE's real built main, preload, DB and PTY owner.
// Only provider execution and usage data are fixtures; no account is queried.
const electron = require('electron')
const { app, BrowserWindow } = electron
const Module = require('node:module')
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const { pathToFileURL } = require('node:url')
const assert = require('node:assert/strict')
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ace-main-smoke-'))
const project = path.join(root, 'project')
fs.mkdirSync(project)
app.setPath('documents', root)
app.setPath('userData', root)
process.env.VITE_DEV_SERVER_URL = pathToFileURL(path.join(__dirname, '../dist/renderer/index.html')).href
const errors = []
const windows = []
function HiddenWindow(options) {
  const win = new BrowserWindow({ ...options, show: false })
  win.webContents.openDevTools = () => {}
  windows.push(win)
  return win
}
Object.setPrototypeOf(HiddenWindow, BrowserWindow)
const originalLoad = Module._load
Module._load = function (name, ...args) {
  if (name === 'electron') return new Proxy(electron, { get(target, key) {
    if (key === 'BrowserWindow') return HiddenWindow
    if (key === 'dialog') return { ...electron.dialog,
      showOpenDialog: async () => ({ canceled: false, filePaths: [project] }),
      showErrorBox: (_title, error) => errors.push(error),
    }
    return target[key]
  } })
  return originalLoad.call(this, name, ...args)
}
const { DBService } = require('../dist/main/services/DBService')
const init = DBService.init.bind(DBService)
DBService.init = async () => { await init(); DBService.setSetting('prereqs_setup_dismissed', 'true') }
const { TokscaleService } = require('../dist/main/services/TokscaleService')
TokscaleService.getQuota = async () => []
TokscaleService.getTodayBreakdown = async () => ({})
TokscaleService.getWorkspaceReport = async () => []
const fixture = path.join(root, 'provider fixture.cjs')
process.env.ACE_SMOKE_LAUNCH_FILE = path.join(root, 'launches.txt')
fs.writeFileSync(fixture, "require('node:fs').appendFileSync(process.env.ACE_SMOKE_LAUNCH_FILE, process.pid + '\\n'); console.log('ACE_FIXTURE_READY'); setInterval(() => {}, 1000)")
require('../dist/main/services/ProviderExecutable').providerExecutable = () => ['node', fixture]
const { TerminalService } = require('../dist/main/services/TerminalService')
require('../dist/main/index')

const pause = () => new Promise(resolve => setTimeout(resolve, 50))
async function until(check) {
  for (let i = 0; i < 200; i++) { if (await check()) return; await pause() }
  throw new Error('Main smoke state timed out: ' + check.toString())
}
const timeout = setTimeout(() => { console.error('Main smoke timed out'); TerminalService.shutdown().finally(() => app.exit(1)) }, 45000)
app.whenReady().then(async () => {
  let failed = false
  try {
    await until(() => windows[0] && !windows[0].webContents.isLoading())
    const win = windows[0]
    const evaluate = source => win.webContents.executeJavaScript(source)
    await until(() => evaluate('!!window.ace'))
    assert.deepEqual(await evaluate('window.ace.getProjects()'), [])
    const location = win.webContents.getURL()
    await evaluate("window.location.href = 'https://example.invalid/'; undefined")
    await pause()
    assert.equal(win.webContents.getURL(), location)
    await evaluate("window.open('https://example.invalid/'); undefined")
    await pause()
    assert.equal(BrowserWindow.getAllWindows().length, 1)
    const foreign = new BrowserWindow({ show: false, webPreferences: { preload: path.join(__dirname, '../dist/main/preload.js'), sandbox: true, contextIsolation: true } })
    await foreign.loadURL('about:blank')
    assert.equal(await foreign.webContents.executeJavaScript("window.ace.getProjects().then(() => false, error => error.message.includes('not permitted'))"), true)
    foreign.destroy()
    assert.equal(await evaluate(`window.ace.addProject('denied', ${JSON.stringify(project)}).then(() => false, () => true)`), true)
    const projects = await evaluate("window.ace.pickFolder().then(folder => window.ace.addProject('Fixture', folder))")
    const selected = projects[0]
    const agent = await evaluate(`window.ace.startAgent(${JSON.stringify({ projectId: selected.id, projectPath: selected.path, label: 'Fixture agent', provider: 'codex', model: 'gpt-5.6-terra' })})`)
    const session = await evaluate(`window.ace.terminal.spawn(${JSON.stringify({ agentId: agent.agentId, cwd: selected.path })})`)
    assert.equal(session.success, true)
    await until(() => fs.existsSync(process.env.ACE_SMOKE_LAUNCH_FILE))
    await evaluate(`localStorage.setItem('ace:recent', ${JSON.stringify(JSON.stringify([selected.id]))})`)
    win.webContents.reload()
    await until(() => !win.webContents.isLoading())
    await until(() => evaluate("document.body.textContent.includes('Fixture agent')"))
    const reattached = await evaluate(`window.ace.terminal.spawn(${JSON.stringify({ agentId: agent.agentId, cwd: selected.path })})`)
    assert.equal(reattached.id, session.id)
    assert.equal(reattached.pid, session.pid)
    assert.equal(fs.readFileSync(process.env.ACE_SMOKE_LAUNCH_FILE, 'utf8').trim().split('\n').length, 1)
    await evaluate(`window.ace.stopAgent(${JSON.stringify(agent.agentId)})`)
    assert.equal(TerminalService.sessions.has(agent.agentId), false)
    const providerPid = Number(fs.readFileSync(process.env.ACE_SMOKE_LAUNCH_FILE, 'utf8').trim())
    await until(() => {
      try { process.kill(providerPid, 0); return false }
      catch (error) { if (error.code === 'ESRCH') return true; throw error }
    })
    assert.deepEqual(errors, [])
    console.log('Real ACE main: navigation/window IPC, native-selection authorization, PTY launch/reload/reconnect/stop passed')
  } catch (error) { failed = true; console.error(error.stack, errors) }
  finally { clearTimeout(timeout); await TerminalService.shutdown(); app.exit(failed ? 1 : 0) }
})
