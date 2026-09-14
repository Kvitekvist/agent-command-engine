const { contextBridge } = require('electron')
const emptyUsage = { plan: null, quota: [], models: [], projects: [], totalTokens: 0, totalCost: 0 }
const noop = () => () => {}
let notes = []
let closeRequested = () => {}
let closeDecision = null
let failSave = false
const historyRequests = new Map()
const settings = new Map()
let projects = Array.from({ length: 20 }, (_, index) => ({ id: index + 1, name: index ? `Project ${index + 1}` : 'Smoke project', path: index ? `/smoke-${index + 1}` : '/smoke' }))
contextBridge.exposeInMainWorld('smoke', {
  requestClose: () => { closeDecision = null; closeRequested() },
  closeDecision: () => closeDecision,
  failSave: value => { failSave = value },
  pendingHistory: id => historyRequests.has(id),
  resolveHistory: (id, rows) => { historyRequests.get(id)?.({ rows }); historyRequests.delete(id) },
})
contextBridge.exposeInMainWorld('ace', {
  platform: process.platform,
  getProjects: async () => projects,
  removeProject: async id => { projects = projects.filter(project => project.id !== id); return projects },
  getAgents: async () => [],
  getSetting: async key => key === 'prereqs_setup_dismissed' ? 'true' : settings.get(key) || null,
  setSetting: async (key, value) => { settings.set(key, value); return { ok: true } },
  getLiveTokenUsage: async () => ({ claude: emptyUsage, codex: emptyUsage }),
  getProjectHistory: id => new Promise(resolve => historyRequests.set(id, resolve)),
  onMenuNavigate: noop, onAgentStatus: noop, offAgentStatus() {},
  onCloseRequested: callback => { closeRequested = callback; return () => { closeRequested = () => {} } },
  closeDecision: value => { closeDecision = value },
  project: { capabilities: async () => ({ ok: false }) },
  prereqs: { check: async () => ({ claude: { present: true }, codex: { present: true }, git: { present: true } }) },
  fs: {
    readDir: async () => ({ ok: true, entries: [{ name: 'sample.js', path: '/smoke/sample.js', isDirectory: false }] }),
    readFile: async () => ({ ok: true, content: 'const sample = 1\n' }),
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
