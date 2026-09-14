import { create } from 'zustand'

const useStore = create((set, get) => ({
  // ── Active view ────────────────────────────────────────────────────────────
  // Restore the last view; new installs start with project work.
  activeView: (() => { try { return localStorage.getItem('ace:view') || 'agents' } catch (_) { return 'agents' } })(),
  setActiveView: (view) => {
    try { localStorage.setItem('ace:view', view) } catch (_) {}
    set({ activeView: view })
  },

  // ── Projects ───────────────────────────────────────────────────────────────
  projects: [],
  activeProject: null,
  setProjects: (projects) => set({ projects }),
  // Open files are absolute paths scoped to whichever project's tree they
  // were opened from -- switching projects closes them. Sidebar.jsx
  // confirms first if any are dirty, same pattern as agent/project delete.
  // Does NOT clear `agents` (TICKET-0030) -- each running agent owns a real
  // PTY-backed terminal session (AgentTerminal.jsx) that must survive a
  // project switch, not just a tab switch (TICKET-0027 already did the
  // equivalent for tabs). AgentView.jsx now renders every agent across
  // every visited project, hiding (not unmounting) any that don't belong
  // to the active project.
  setActiveProject: (project) => set(s => s.activeProject?.id === project?.id ? s : { activeProject: project, openFiles: [], activeFilePath: null }),

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
  reconcileFiles: (oldPath, newPath) => set(s => {
    const affected = value => value === oldPath || value?.startsWith(oldPath + '/') || value?.startsWith(oldPath + '\\')
    const openFiles = s.openFiles.flatMap(file => {
      if (!affected(file.path)) return [file]
      if (!newPath) return []
      const renamed = newPath + file.path.slice(oldPath.length)
      return [{ ...file, path: renamed, name: renamed.split(/[\\/]/).pop() }]
    })
    const activeFilePath = affected(s.activeFilePath)
      ? newPath ? newPath + s.activeFilePath.slice(oldPath.length) : openFiles.at(-1)?.path || null
      : s.activeFilePath
    return { openFiles, activeFilePath }
  }),

  updateFileContent: (filePath, content) =>
    set((s) => ({
      openFiles: s.openFiles.map((f) =>
        f.path === filePath ? { ...f, content, dirty: content !== f.originalContent } : f
      ),
    })),

  markFileSaved: (filePath, savedContent) =>
    set((s) => ({
      openFiles: s.openFiles.map((f) =>
        f.path === filePath ? { ...f, originalContent: savedContent, dirty: f.content !== savedContent } : f
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

  // Updates session title in place so the card's display and every other
  // read picks it up without a full agent reload.
  updateAgentSessionTitle: (agentId, sessionTitle) =>
    set((s) => ({
      agents: s.agents.map((a) => a.agentId === agentId ? { ...a, sessionTitle } : a),
    })),

  // ── Token stats ────────────────────────────────────────────────────────────
  tokenStats: [],
  settingsRevision: 0,
  settingsUpdated: () => set(s => ({ settingsRevision: s.settingsRevision + 1 })),
  setTokenStats: (stats) => set({ tokenStats: stats }),

  // ── Live token usage (TICKET-0022, shared TICKET-0023) ────────────────────
  // Whole-machine subscription quota from tokscale -- not scoped to the
  // active ACE project. Polled once here (started from App.jsx) rather than
  // per-view, so the Agents tab's compact UsageBar and the Token Usage tab's
  // full UsageCard pair both read the same data without each spawning their
  // own tokscale subprocess call on its own timer.
  liveUsage: {
    claude: { plan: null, quota: [], models: [], projects: [], totalTokens: 0, totalCost: 0 },
    codex: { plan: null, quota: [], models: [], projects: [], totalTokens: 0, totalCost: 0 },
  },
  liveUsageLoading: true,
  liveUsageError: null,
  loadLiveUsage: async () => {
    try {
      const usage = await window.ace.getLiveTokenUsage()
      set({ liveUsage: usage, liveUsageError: null })
    } catch (error) { set({ liveUsageError: error.message }) }
    finally { set({ liveUsageLoading: false }) }
  },

  // ── Settings ───────────────────────────────────────────────────────────────

  // ── Notification sounds ────────────────────────────────────────────────────
  soundsMuted: false,
  setSoundsMuted: (muted) => set({ soundsMuted: muted }),
  loadSoundsMuted: async () => {
    const muted = await window.ace.getSetting('notification_sounds_muted')
    set({ soundsMuted: muted === true })
  },
  toggleSoundsMuted: async () => {
    const newMuted = !get().soundsMuted
    await window.ace.setSetting('notification_sounds_muted', newMuted)
    set({ soundsMuted: newMuted })
  },
}))

export default useStore
