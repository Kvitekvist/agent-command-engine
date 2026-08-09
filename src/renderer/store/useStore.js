import { create } from 'zustand'

const useStore = create((set, get) => ({
  // ── Active view ────────────────────────────────────────────────────────────
  // Default is 'tokens' (TICKET-0022) -- the live usage dashboard is
  // project-independent and useful the instant the app opens, unlike
  // 'agents' which needs a project selected first.
  activeView: 'tokens', // 'agents' | 'audit' | 'tokens' | 'settings' | 'editor'
  setActiveView: (view) => set({ activeView: view }),

  // ── Projects ───────────────────────────────────────────────────────────────
  projects: [],
  activeProject: null,
  setProjects: (projects) => set({ projects }),
  // Open files are absolute paths scoped to whichever project's tree they
  // were opened from -- switching projects closes them, same as switching
  // projects already clears the running-agent cards above. Sidebar.jsx
  // confirms first if any are dirty, same pattern as agent/project delete.
  setActiveProject: (project) => set({ activeProject: project, agents: [], openFiles: [], activeFilePath: null }),

  // ── File explorer / editor (TICKET-0021) ──────────────────────────────────
  // [{ path, name, content, originalContent, dirty }]
  openFiles: [],
  activeFilePath: null,

  openFile: (filePath, name, content) =>
    set((s) => {
      if (s.openFiles.some((f) => f.path === filePath)) {
        return { activeFilePath: filePath }
      }
      const file = { path: filePath, name, content, originalContent: content, dirty: false }
      return { openFiles: [...s.openFiles, file], activeFilePath: filePath }
    }),

  closeFile: (filePath) =>
    set((s) => {
      const openFiles = s.openFiles.filter((f) => f.path !== filePath)
      let activeFilePath = s.activeFilePath
      if (activeFilePath === filePath) {
        activeFilePath = openFiles.length ? openFiles[openFiles.length - 1].path : null
      }
      return { openFiles, activeFilePath }
    }),

  setActiveFile: (filePath) => set({ activeFilePath: filePath }),

  updateFileContent: (filePath, content) =>
    set((s) => ({
      openFiles: s.openFiles.map((f) =>
        f.path === filePath ? { ...f, content, dirty: content !== f.originalContent } : f
      ),
    })),

  markFileSaved: (filePath) =>
    set((s) => ({
      openFiles: s.openFiles.map((f) =>
        f.path === filePath ? { ...f, originalContent: f.content, dirty: false } : f
      ),
    })),

  // ── Agents (running) ───────────────────────────────────────────────────────
  // [{ agentId, label, provider, model, permissionMode, projectPath, status }]
  // -- each 'running' agent's own live output lives in its embedded terminal
  // (AgentTerminal.jsx), not in this store.
  agents: [],

  addAgent: (agent) =>
    set((s) => ({ agents: [...s.agents, agent] })),

  updateAgentStatus: (agentId, status, extra = {}) =>
    set((s) => ({
      agents: s.agents.map((a) => a.agentId === agentId ? { ...a, status, ...extra } : a),
    })),

  removeAgent: (agentId) =>
    set((s) => ({
      agents: s.agents.filter((a) => a.agentId !== agentId),
    })),

  // ── Audit log ──────────────────────────────────────────────────────────────
  auditPrompts: [],
  setAuditPrompts: (prompts) => set({ auditPrompts: prompts }),

  // ── Token stats ────────────────────────────────────────────────────────────
  tokenStats: [],
  setTokenStats: (stats) => set({ tokenStats: stats }),

  // ── Live token usage (TICKET-0022, shared TICKET-0023) ────────────────────
  // Whole-machine subscription quota from tokscale -- not scoped to the
  // active CPI project. Polled once here (started from App.jsx) rather than
  // per-view, so the Agents tab's compact UsageBar and the Token Usage tab's
  // full UsageCard pair both read the same data without each spawning their
  // own tokscale subprocess call on its own timer.
  liveUsage: {
    claude: { plan: null, quota: [], models: [], projects: [], totalTokens: 0 },
    codex: { plan: null, quota: [], models: [], projects: [], totalTokens: 0 },
  },
  liveUsageLoading: true,
  loadLiveUsage: async () => {
    const usage = await window.cpi.getLiveTokenUsage()
    set({ liveUsage: usage, liveUsageLoading: false })
  },

  // ── Optimization advisor ───────────────────────────────────────────────────
  optimizationResult: null,
  setOptimizationResult: (result) => set({ optimizationResult: result }),

  // ── Settings ───────────────────────────────────────────────────────────────
  defaultModel: 'claude-sonnet-5',
  defaultProvider: 'claude',
  setDefaultModel: (m) => set({ defaultModel: m }),
  setDefaultProvider: (p) => set({ defaultProvider: p }),
}))

export default useStore
