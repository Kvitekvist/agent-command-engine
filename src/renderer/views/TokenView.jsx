import React, { useEffect, useState } from 'react'
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from 'recharts'
import useStore from '../store/useStore'

// Cost estimates per 1M tokens (approximate mid-2026 pricing)
const COST_PER_M = {
  'claude-haiku-4-5-20251001': { input: 0.80,  output: 4.00  },
  'claude-sonnet-5':           { input: 3.00,  output: 15.00 },
  'claude-opus-4-8':           { input: 15.00, output: 75.00 },
  'claude-fable-5':            { input: 5.00,  output: 25.00 },
  'codex-mini-latest':         { input: 1.50,  output: 6.00  },
  'o3':                        { input: 10.00, output: 40.00 },
  'o4-mini':                   { input: 3.00,  output: 12.00 },
}

function estimateCost(model, inputTokens, outputTokens) {
  const rates = COST_PER_M[model] || { input: 3, output: 15 }
  return (inputTokens / 1_000_000) * rates.input + (outputTokens / 1_000_000) * rates.output
}

export default function TokenView() {
  const { activeProject, tokenStats, setTokenStats } = useStore()
  const [loading, setLoading] = useState(false)
  const [view, setView]       = useState('daily') // 'daily' | 'model' | 'task'

  async function load() {
    setLoading(true)
    const filters = activeProject ? { projectId: activeProject.id } : {}
    const rows = await window.cpi.getTokenStats(filters)
    setTokenStats(rows)
    setLoading(false)
  }

  useEffect(() => { load() }, [activeProject])

  // Aggregate by day for the line chart
  const byDay = Object.values(
    tokenStats.reduce((acc, row) => {
      const d = row.day || 'unknown'
      if (!acc[d]) acc[d] = { day: d, input: 0, output: 0, cost: 0, prompts: 0 }
      acc[d].input   += row.total_input   || 0
      acc[d].output  += row.total_output  || 0
      acc[d].prompts += row.prompt_count  || 0
      acc[d].cost    += estimateCost(row.model, row.total_input || 0, row.total_output || 0)
      return acc
    }, {})
  ).sort((a, b) => a.day.localeCompare(b.day))

  // Aggregate by model
  const byModel = Object.values(
    tokenStats.reduce((acc, row) => {
      const m = row.model || 'unknown'
      if (!acc[m]) acc[m] = { model: m, input: 0, output: 0, cost: 0 }
      acc[m].input  += row.total_input  || 0
      acc[m].output += row.total_output || 0
      acc[m].cost   += estimateCost(m, row.total_input || 0, row.total_output || 0)
      return acc
    }, {})
  )

  // Aggregate by task
  const byTask = Object.values(
    tokenStats.reduce((acc, row) => {
      const t = row.task_label || 'unlabeled'
      if (!acc[t]) acc[t] = { task: t, input: 0, output: 0, cost: 0 }
      acc[t].input  += row.total_input  || 0
      acc[t].output += row.total_output || 0
      acc[t].cost   += estimateCost(row.model, row.total_input || 0, row.total_output || 0)
      return acc
    }, {})
  )

  const totalTokens = byDay.reduce((s, d) => s + d.input + d.output, 0)
  const totalCost   = byDay.reduce((s, d) => s + d.cost, 0)
  const totalPrompts = byDay.reduce((s, d) => s + d.prompts, 0)

  const chartColors = { input: '#7c6af7', output: '#22c55e', cost: '#f59e0b' }

  return (
    <div className="p-5 space-y-6 overflow-y-auto h-full">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Token Usage</h2>
        <button onClick={load} className="btn-ghost text-xs">↻ Refresh</button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Total Tokens" value={totalTokens.toLocaleString()} sub="all time" />
        <StatCard label="Total Prompts" value={totalPrompts.toLocaleString()} sub="logged" />
        <StatCard label="Est. Cost" value={`$${totalCost.toFixed(4)}`} sub="approximate" color="text-warning" />
      </div>

      {/* View tabs */}
      <div className="flex gap-2">
        {[['daily', 'By Day'], ['model', 'By Model'], ['task', 'By Task']].map(([id, label]) => (
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

      {!loading && view === 'task' && (
        <div className="space-y-4">
          <ChartCard title="Token Usage by Task">
            <ResponsiveContainer width="100%" height={Math.max(200, byTask.length * 40)}>
              <BarChart data={byTask} layout="vertical" margin={{ top: 4, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3a" />
                <XAxis type="number" tick={{ fill: '#6b7280', fontSize: 11 }} />
                <YAxis type="category" dataKey="task" tick={{ fill: '#6b7280', fontSize: 10 }} width={120} />
                <Tooltip contentStyle={{ background: '#1a1d27', border: '1px solid #2a2d3a', fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="input"  name="Input"  fill={chartColors.input}  />
                <Bar dataKey="output" name="Output" fill={chartColors.output} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
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
            <th className="text-right pb-2">Input</th>
            <th className="text-right pb-2">Output</th>
            <th className="text-right pb-2">Est. Cost</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {data.map((row) => (
            <tr key={row.model}>
              <td className="py-1.5 text-gray-300">{row.model}</td>
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
