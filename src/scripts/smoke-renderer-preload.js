const { contextBridge } = require('electron')
const emptyUsage = { plan: null, quota: [], models: [], projects: [], totalTokens: 0, totalCost: 0 }
const noop = () => () => {}
let notes = []
let closeRequested = () => {}
let menuNavigate = () => {}
let closeDecision = null
let failSave = false
const historyRequests = new Map()
const memoryReads = new Map()
const createRequests = []
const settings = new Map()
let projects = Array.from({ length: 20 }, (_, index) => ({ id: index + 1, name: index ? `Project ${index + 1}` : 'Smoke project', path: index ? `/smoke-${index + 1}` : '/smoke' }))
contextBridge.exposeInMainWorld('smoke', {
  requestClose: () => { closeDecision = null; closeRequested() },
  closeDecision: () => closeDecision,
  failSave: value => { failSave = value },
  pendingHistory: id => historyRequests.has(id),
  resolveHistory: (id, rows) => { historyRequests.get(id)?.({ rows }); historyRequests.delete(id) },
  createRequests: () => createRequests.length,
  resolveCreate: result => createRequests.shift()?.(result),
  // Settings is reached through the application menu, not the sidebar.
  navigate: view => menuNavigate(view),
  pendingMemory: name => memoryReads.has(name),
  resolveMemory: (name, content) => { memoryReads.get(name)?.({ ok: true, content }); memoryReads.delete(name) },
})
contextBridge.exposeInMainWorld('ace', {
  platform: process.platform,
  getProjects: async () => projects,
  removeProject: async id => { projects = projects.filter(project => project.id !== id); return projects },
  // New-project wizard (TICKET-0164): creates stay pending until the smoke
  // script answers them, so it can count submissions and inject a collision.
  getDefaultParentDir: async () => null,
  pickFolder: async () => 'C:\\Smoke parent',
  createNewProject: (name, description, parentDir) => new Promise(resolve => createRequests.push(resolve)),
  addProject: async (name, path) => { projects = [...projects, { id: projects.length + 100, name, path }] },
  getAgents: async () => [],
  getSetting: async key => key === 'prereqs_setup_dismissed' ? 'true' : settings.get(key) || null,
  setSetting: async (key, value) => { settings.set(key, value); return { ok: true } },
  getLiveTokenUsage: async () => ({ claude: emptyUsage, codex: emptyUsage }),
  getProjectHistory: id => new Promise(resolve => historyRequests.set(id, resolve)),
  onMenuNavigate: callback => { menuNavigate = callback; return () => { menuNavigate = () => {} } }, onAgentStatus: noop, offAgentStatus() {}, onAgentActivity: noop,
  terminal: { onData: noop, onExit: noop },
  onCloseRequested: callback => { closeRequested = callback; return () => { closeRequested = () => {} } },
  closeDecision: value => { closeDecision = value },
  project: { capabilities: async () => ({ ok: false }) },
  prereqs: { check: async () => ({ claude: { present: true }, codex: { present: true }, git: { present: true } }) },
  fs: {
    readDir: async (_root, dir) => dir === '.claude/memory'
      ? ({ ok: true, entries: ['a.md', 'b.md'].map(name => ({ name, path: `/smoke/.claude/memory/${name}`, isDirectory: false })) })
      : ({ ok: true, entries: [{ name: 'sample.js', path: '/smoke/sample.js', isDirectory: false }] }),
    // Memory reads stay pending until the smoke script resolves them, so it
    // can answer them out of order (TICKET-0167).
    readFile: (_root, file) => file.startsWith('.claude/memory/')
      ? new Promise(resolve => memoryReads.set(file.split('/').pop(), resolve))
      : Promise.resolve({ ok: true, content: 'const sample = 1\n' }),
    writeFile: async () => failSave ? ({ ok: false, error: 'Simulated editor save failure' }) : ({ ok: true }),
  },
  notes: {
    read: async () => ({ ok: true, notes }),
    mutate: async (_root, mutation) => {
      if (mutation.text === 'failed draft') return { ok: false, error: 'Simulated read-only notes file' }
      if (mutation.text === 'delayed draft') await new Promise(resolve => setTimeout(resolve, 400))
      if (mutation.type === 'add') notes.push({ id: String(notes.length), timestamp: new Date().toISOString(), text: mutation.text })
      return { ok: true, notes }
    },
  },
})
