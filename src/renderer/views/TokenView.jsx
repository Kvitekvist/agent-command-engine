import React, { useEffect, useState } from 'react'
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from 'recharts'
import useStore from '../store/useStore'
import UsageCard from '../components/UsageCard'
import claudeIcon from '../assets/icons/claude.svg?raw'
import codexIcon from '../assets/icons/codex.svg?raw'

// TICKET-0022: matches the reference design (token-monitor) screenshot the
// user pointed to, not token-monitor's own (slightly different) CSS palette.
const PROVIDER_COLOR = { claude: '#d97757', codex: '#3b82f6' }

export default function TokenView() {
  // liveUsage/liveUsageLoading/loadLiveUsage (TICKET-0022, shared TICKET-0023):
  // polled once from App.jsx so this tab and the Agents tab's compact
  // UsageBar read the same data instead of each spawning their own
  // tokscale subprocess call on its own timer.
  const { activeProject, tokenStats, setTokenStats, liveUsage, liveUsageLoading, loadLiveUsage } = useStore()
  const [loading, setLoading] = useState(false)
  const [view, setView]       = useState('daily') // 'daily' | 'model' | 'agent' | 'session'

  // TICKET-0044: "History (this project)" now reads real per-session usage
  // from tokscale (via getProjectHistory), scoped to the active project's
  // workspace, instead of ACE's own `prompts` table (dead since TICKET-0019,
  // removed in TICKET-0083).
  // `tokenStats` holds the normalized row list the main process returns.
  async function load() {
    if (!activeProject) { setTokenStats([]); return }
    setLoading(true)
    const { rows } = await window.ace.getProjectHistory(activeProject.id, activeProject.path)
    setTokenStats(rows || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [activeProject])

  // Aggregate by day
  const byDay = Object.values(
    tokenStats.reduce((acc, row) => {
      const d = row.day || 'unknown'
      if (!acc[d]) acc[d] = { day: d, input: 0, output: 0, cacheRead: 0, cost: 0, prompts: 0 }
      acc[d].input     += row.input     || 0
      acc[d].output    += row.output    || 0
      acc[d].cacheRead += row.cacheRead  || 0
      acc[d].prompts   += row.prompts    || 0
      acc[d].cost      += row.cost       || 0
      return acc
    }, {})
  ).sort((a, b) => a.day.localeCompare(b.day))

  // Aggregate by model
  const byModel = Object.values(
    tokenStats.reduce((acc, row) => {
      const m = row.model || 'unknown'
      if (!acc[m]) acc[m] = { model: m, input: 0, output: 0, cost: 0, prompts: 0 }
      acc[m].input   += row.input   || 0
      acc[m].output  += row.output  || 0
      acc[m].cost    += row.cost    || 0
      acc[m].prompts += row.prompts || 0
      return acc
    }, {})
  ).sort((a, b) => (b.input + b.output) - (a.input + a.output))

  // Aggregate by agent name (TICKET-0044) -- sessions whose id ACE recorded
  // at launch resolve to their agent's name; everything else is "Untracked".
  const byAgent = Object.values(
    tokenStats.reduce((acc, row) => {
      const name = row.agentName || 'Untracked'
      if (!acc[name]) acc[name] = { agent: name, input: 0, output: 0, cost: 0, prompts: 0 }
      acc[name].input   += row.input   || 0
      acc[name].output  += row.output  || 0
      acc[name].cost    += row.cost    || 0
      acc[name].prompts += row.prompts || 0
      return acc
    }, {})
  ).sort((a, b) => (b.input + b.output) - (a.input + a.output))

  // Aggregate by session title -- sessions with a title are grouped together;
  // untitled and untracked sessions appear as "Untitled".
  const bySession = Object.values(
    tokenStats.reduce((acc, row) => {
      const title = row.sessionTitle || 'Untitled'
      if (!acc[title]) acc[title] = { session: title, input: 0, output: 0, cost: 0, prompts: 0 }
      acc[title].input   += row.input   || 0
      acc[title].output  += row.output  || 0
      acc[title].cost    += row.cost    || 0
      acc[title].prompts += row.prompts || 0
      return acc
    }, {})
  ).sort((a, b) => (b.input + b.output) - (a.input + a.output))

  const totalTokens    = tokenStats.reduce((s, r) => s + (r.input || 0) + (r.output || 0) + (r.cacheRead || 0), 0)
  const totalCost      = tokenStats.reduce((s, r) => s + (r.cost || 0), 0)
  const totalPrompts   = tokenStats.reduce((s, r) => s + (r.prompts || 0), 0)
  const totalCacheRead = tokenStats.reduce((s, r) => s + (r.cacheRead || 0), 0)

  const chartColors = { input: '#7c6af7', output: '#22c55e', cost: '#f59e0b' }

  return (
    <div className="p-5 space-y-6 overflow-y-auto h-full">
      {/* Live usage (TICKET-0022) -- real subscription quota + today's
          usage straight from tokscale, independent of ACE's own project
          selection (the old `prompts` DB table was removed in TICKET-0083). */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Usage</h2>
        <button onClick={loadLiveUsage} className="btn-ghost text-xs">↻ Refresh</button>
      </div>
      {liveUsageLoading ? (
        <div className="text-xs text-muted">Loading live usage…</div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <UsageCard name="Claude" iconSvg={claudeIcon} color={PROVIDER_COLOR.claude} data={liveUsage.claude} />
          <UsageCard name="Codex" iconSvg={codexIcon} color={PROVIDER_COLOR.codex} data={liveUsage.codex} />
        </div>
      )}

      {/* Historical (this project, from tokscale's session records) */}
      <div className="flex items-center justify-between pt-2 border-t border-border">
        <div>
          <h2 className="text-base font-semibold mt-4">History (this project)</h2>
          <p className="text-xs text-muted mt-0.5">
            All-time usage for this project, from tokscale's own session records. By Agent shows ACE agent names; By Session shows session titles (auto-generated or user-set); other sessions (and Codex) appear as "Untracked" or "Untitled".
          </p>
        </div>
        <button onClick={load} className="btn-ghost text-xs mt-4">↻ Refresh</button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Total Tokens" value={totalTokens.toLocaleString()} sub="input + output + cache read" />
        <StatCard label="Cache Read Tokens" value={totalCacheRead.toLocaleString()} sub="prompt cache" />
        <StatCard label="Total Prompts" value={totalPrompts.toLocaleString()} sub="messages" />
        <StatCard label="Cost" value={`$${totalCost.toFixed(4)}`} sub="from tokscale" color="text-warning" />
      </div>

      {!loading && activeProject && tokenStats.length === 0 && (
        <div className="text-xs text-muted">No recorded usage for this project yet.</div>
      )}
      {!activeProject && (
        <div className="text-xs text-muted">Select a project to see its history.</div>
      )}

      {/* View tabs */}
      <div className="flex gap-2">
        {[['daily', 'By Day'], ['model', 'By Model'], ['agent', 'By Agent'], ['session', 'By Session']].map(([id, label]) => (
          <button
            key={id}
            onClick={() => setView(id)}
            className={`text-xs px-3 py-1.5 rounded transition-colors
              ${view === id ? 'bg-accent text-white' : 'btn-ghost'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading && <div className="text-xs text-muted">Loading…</div>}

      {!loading && view === 'daily' && (
        <div className="space-y-6">
          <ChartCard title="Daily Token Usage">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={byDay} margin={{ top: 4, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3a" />
                <XAxis dataKey="day" tick={{ fill: '#6b7280', fontSize: 11 }} />
                <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} />
                <Tooltip contentStyle={{ background: '#1a1d27', border: '1px solid #2a2d3a', fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="input"  name="Input"  fill={chartColors.input}  radius={[2,2,0,0]} />
                <Bar dataKey="output" name="Output" fill={chartColors.output} radius={[2,2,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Daily Estimated Cost (USD)">
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={byDay} margin={{ top: 4, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3a" />
                <XAxis dataKey="day" tick={{ fill: '#6b7280', fontSize: 11 }} />
                <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ background: '#1a1d27', border: '1px solid #2a2d3a', fontSize: 12 }}
                  formatter={(v) => [`$${v.toFixed(4)}`, 'Cost']}
                />
                <Line type="monotone" dataKey="cost" stroke={chartColors.cost} dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      )}

      {!loading && view === 'model' && (
        <div className="space-y-4">
          <ChartCard title="Token Usage by Model">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={byModel} margin={{ top: 4, right: 20, left: 0, bottom: 0 }} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3a" />
                <XAxis type="number" tick={{ fill: '#6b7280', fontSize: 11 }} />
                <YAxis type="category" dataKey="model" tick={{ fill: '#6b7280', fontSize: 10 }} width={160} />
                <Tooltip contentStyle={{ background: '#1a1d27', border: '1px solid #2a2d3a', fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="input"  name="Input"  fill={chartColors.input}  />
                <Bar dataKey="output" name="Output" fill={chartColors.output} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
          <ModelCostTable data={byModel} />
        </div>
      )}

      {!loading && view === 'agent' && (
        <div className="space-y-4">
          <ChartCard title="Token Usage by Agent">
            <ResponsiveContainer width="100%" height={Math.max(200, byAgent.length * 40)}>
              <BarChart data={byAgent} layout="vertical" margin={{ top: 4, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3a" />
                <XAxis type="number" tick={{ fill: '#6b7280', fontSize: 11 }} />
                <YAxis type="category" dataKey="agent" tick={{ fill: '#6b7280', fontSize: 10 }} width={140} />
                <Tooltip contentStyle={{ background: '#1a1d27', border: '1px solid #2a2d3a', fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="input"  name="Input"  fill={chartColors.input}  />
                <Bar dataKey="output" name="Output" fill={chartColors.output} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
          <AgentCostTable data={byAgent} />
        </div>
      )}

      {!loading && view === 'session' && (
        <div className="space-y-4">
          <ChartCard title="Token Usage by Session">
            <ResponsiveContainer width="100%" height={Math.max(200, bySession.length * 40)}>
              <BarChart data={bySession} layout="vertical" margin={{ top: 4, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3a" />
                <XAxis type="number" tick={{ fill: '#6b7280', fontSize: 11 }} />
                <YAxis type="category" dataKey="session" tick={{ fill: '#6b7280', fontSize: 10 }} width={180} />
                <Tooltip contentStyle={{ background: '#1a1d27', border: '1px solid #2a2d3a', fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="input"  name="Input"  fill={chartColors.input}  />
                <Bar dataKey="output" name="Output" fill={chartColors.output} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
          <SessionCostTable data={bySession} />
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, sub, color = 'text-gray-100' }) {
  return (
    <div className="card">
      <div className="text-xs text-muted mb-1">{label}</div>
      <div className={`text-2xl font-semibold ${color}`}>{value}</div>
      <div className="text-xs text-muted mt-0.5">{sub}</div>
    </div>
  )
}

function ChartCard({ title, children }) {
  return (
    <div className="card">
      <div className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">{title}</div>
      {children}
    </div>
  )
}

function ModelCostTable({ data }) {
  return (
    <div className="card">
      <div className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Cost Breakdown by Model</div>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-muted border-b border-border">
            <th className="text-left pb-2">Model</th>
            <th className="text-right pb-2">Prompts</th>
            <th className="text-right pb-2">Input</th>
            <th className="text-right pb-2">Output</th>
            <th className="text-right pb-2">Cost</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {data.map((row) => (
            <tr key={row.model}>
              <td className="py-1.5 text-gray-300">{row.model}</td>
              <td className="text-right text-gray-400">{row.prompts.toLocaleString()}</td>
              <td className="text-right text-gray-400">{row.input.toLocaleString()}</td>
              <td className="text-right text-gray-400">{row.output.toLocaleString()}</td>
              <td className="text-right text-warning">${row.cost.toFixed(4)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function AgentCostTable({ data }) {
  return (
    <div className="card">
      <div className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Cost Breakdown by Agent</div>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-muted border-b border-border">
            <th className="text-left pb-2">Agent</th>
            <th className="text-right pb-2">Prompts</th>
            <th className="text-right pb-2">Input</th>
            <th className="text-right pb-2">Output</th>
            <th className="text-right pb-2">Cost</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {data.map((row) => (
            <tr key={row.agent}>
              <td className="py-1.5 text-gray-300">{row.agent}</td>
              <td className="text-right text-gray-400">{row.prompts.toLocaleString()}</td>
              <td className="text-right text-gray-400">{row.input.toLocaleString()}</td>
              <td className="text-right text-gray-400">{row.output.toLocaleString()}</td>
              <td className="text-right text-warning">${row.cost.toFixed(4)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function SessionCostTable({ data }) {
  return (
    <div className="card">
      <div className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Cost Breakdown by Session</div>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-muted border-b border-border">
            <th className="text-left pb-2">Session Title</th>
            <th className="text-right pb-2">Prompts</th>
            <th className="text-right pb-2">Input</th>
            <th className="text-right pb-2">Output</th>
            <th className="text-right pb-2">Cost</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {data.map((row) => (
            <tr key={row.session}>
              <td className="py-1.5 text-gray-300">{row.session}</td>
              <td className="text-right text-gray-400">{row.prompts.toLocaleString()}</td>
              <td className="text-right text-gray-400">{row.input.toLocaleString()}</td>
              <td className="text-right text-gray-400">{row.output.toLocaleString()}</td>
              <td className="text-right text-warning">${row.cost.toFixed(4)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
