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
  agents: [],       // [{ agentId, label, provider, model, status }]
  agentOutputs: {}, // { agentId: string[] }

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
    })),

  appendOutput: (agentId, text) =>
    set((s) => ({
      agentOutputs: {
        ...s.agentOutputs,
        [agentId]: [...(s.agentOutputs[agentId] || []), text],
      },
    })),

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
