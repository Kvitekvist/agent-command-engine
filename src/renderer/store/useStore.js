import { create } from 'zustand'

const useStore = create((set, get) => ({
  // ── Active view ────────────────────────────────────────────────────────────
  activeView: 'agents', // 'agents' | 'audit' | 'tokens' | 'settings'
  setActiveView: (view) => set({ activeView: view }),

  // ── Projects ───────────────────────────────────────────────────────────────
  projects: [],
  activeProject: null,
  setProjects: (projects) => set({ projects }),
  setActiveProject: (project) => set({ activeProject: project, agents: [], agentOutputs: {} }),

  // ── Agents (running) ───────────────────────────────────────────────────────
  agents: [],        // [{ agentId, label, provider, model, status }]
  // agentOutputs: { agentId: [{ role: 'user'|'agent', content: string, done: boolean }] }
  agentOutputs: {},
  agentThinking: {}, // { agentId: boolean } — true while a prompt is in-flight

  addAgent: (agent) =>
    set((s) => ({ agents: [...s.agents, agent] })),

  updateAgentStatus: (agentId, status, extra = {}) =>
    set((s) => ({
      agents: s.agents.map((a) => a.agentId === agentId ? { ...a, status, ...extra } : a),
    })),

  removeAgent: (agentId) =>
    set((s) => ({
      agents: s.agents.filter((a) => a.agentId !== agentId),
      agentOutputs: Object.fromEntries(
        Object.entries(s.agentOutputs).filter(([id]) => id !== agentId)
      ),
      agentThinking: Object.fromEntries(
        Object.entries(s.agentThinking).filter(([id]) => id !== agentId)
      ),
    })),

  // Add a user message
  addUserMessage: (agentId, content) =>
    set((s) => ({
      agentOutputs: {
        ...s.agentOutputs,
        [agentId]: [...(s.agentOutputs[agentId] || []), { role: 'user', content, done: true }],
      },
    })),

  // Start a new agent message (empty, streaming)
  startAgentMessage: (agentId) =>
    set((s) => ({
      agentOutputs: {
        ...s.agentOutputs,
        [agentId]: [...(s.agentOutputs[agentId] || []), { role: 'agent', content: '', done: false }],
      },
    })),

  // Append text delta to the last agent message.
  // If no agent placeholder exists yet, create one automatically (handles timing races).
  appendOutput: (agentId, text) =>
    set((s) => {
      const msgs = s.agentOutputs[agentId] || []
      const last = msgs[msgs.length - 1]
      if (!last || last.role !== 'agent') {
        // Auto-create agent message placeholder
        const placeholder = { role: 'agent', content: text, done: false }
        return { agentOutputs: { ...s.agentOutputs, [agentId]: [...msgs, placeholder] } }
      }
      const updated = { ...last, content: last.content + text }
      return { agentOutputs: { ...s.agentOutputs, [agentId]: [...msgs.slice(0, -1), updated] } }
    }),

  // Mark the last agent message as done
  finalizeAgentMessage: (agentId) =>
    set((s) => {
      const msgs = s.agentOutputs[agentId] || []
      const last = msgs[msgs.length - 1]
      if (!last || last.role !== 'agent') return s
      const updated = { ...last, done: true }
      return { agentOutputs: { ...s.agentOutputs, [agentId]: [...msgs.slice(0, -1), updated] } }
    }),

  setAgentThinking: (agentId, thinking) =>
    set((s) => ({
      agentThinking: { ...s.agentThinking, [agentId]: thinking },
    })),

  // Reset a single agent's visible thread (used by "Clear Context")
  clearAgentThread: (agentId) =>
    set((s) => ({
      agentOutputs: { ...s.agentOutputs, [agentId]: [] },
      agentThinking: { ...s.agentThinking, [agentId]: false },
    })),

  // Rebuild an agent's thread from persisted DB prompt rows (oldest first),
  // used when an agent is restored after the app reopens or the project is
  // reselected.
  restoreAgentThread: (agentId, promptRows) =>
    set((s) => {
      const msgs = []
      for (const row of promptRows) {
        msgs.push({ role: 'user', content: row.prompt_text, done: true })
        if (row.response_text) {
          msgs.push({ role: 'agent', content: row.response_text, done: true })
        }
      }
      return { agentOutputs: { ...s.agentOutputs, [agentId]: msgs } }
    }),

  // ── Audit log ──────────────────────────────────────────────────────────────
  auditPrompts: [],
  setAuditPrompts: (prompts) => set({ auditPrompts: prompts }),

  // ── Token stats ────────────────────────────────────────────────────────────
  tokenStats: [],
  setTokenStats: (stats) => set({ tokenStats: stats }),

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
