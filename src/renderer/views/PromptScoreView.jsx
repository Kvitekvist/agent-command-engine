import React, { useEffect, useState } from 'react'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { formatTokens } from '../components/UsageCard'
import {
  median, splitCurrentPrevious, bucketByTime, modelCostTiers, modelMixByTier,
  computeTokenEfficiencyScore, promptsPerChatDistribution, firstPromptStats, firstPromptTrend,
  totalTokens,
} from '../utils/promptScore.mjs'

const RANGES = [
  { id: '7', label: '7 days', days: 7 },
  { id: '30', label: '30 days', days: 30 },
  { id: '90', label: '90 days', days: 90 },
  { id: 'all', label: 'All time', days: null },
]

const TIER_COLOR = { economy: '#22c55e', balanced: '#f59e0b', premium: '#ef4444' }
const TIER_BADGE = { economy: 'badge-green', balanced: 'badge-yellow', premium: 'badge-red' }
const TIER_LABEL = { economy: 'Lower-cost', balanced: 'Balanced', premium: 'Higher-cost' }
const TONE_COLOR = { good: 'text-success', fair: 'text-warning', low: 'text-danger' }

const chartTick = { fill: '#a1a7b3', fontSize: 12 }
const tooltipStyle = { background: '#1a1d27', border: '1px solid #2a2d3a', fontSize: 12 }

export default function PromptScoreView() {
  const [allRows, setAllRows] = useState([])
  const [trackedSince, setTrackedSince] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [rangeId, setRangeId] = useState('30')

  async function load() {
    setLoading(true)
    setError('')
    try {
      const { rows, promptLengthTrackedSince } = await window.ace.getPromptScore()
      setAllRows(rows || [])
      setTrackedSince(promptLengthTrackedSince)
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const range = RANGES.find((r) => r.id === rangeId)
  const { current: rows, previous } = splitCurrentPrevious(allRows, range.days)
  const unit = range.days == null || range.days > 30 ? 'week' : 'day'

  const efficiency = computeTokenEfficiencyScore(rows, previous)
  const trend = bucketByTime(rows, unit)
  const tiers = modelCostTiers(rows)
  const mix = modelMixByTier(rows)
  const distribution = promptsPerChatDistribution(rows)
  const firstPrompt = firstPromptStats(rows)
  const firstPromptSeries = firstPromptTrend(rows, unit)

  const sessionCount = rows.length
  const medianPrompts = median(rows.map((r) => r.prompts))
  const medianTokens = median(rows.map((r) => totalTokens(r)))
  const totalCost = rows.reduce((s, r) => s + (r.cost || 0), 0)

  return (
    <div className="p-5 space-y-6 overflow-y-auto h-full">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-base font-semibold">Prompt Score</h2>
          <p className="text-xs text-muted mt-0.5">
            How you use AI through ACE, across every project, from tokscale's session records.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {RANGES.map((r) => (
              <button
                key={r.id}
                onClick={() => setRangeId(r.id)}
                className={`text-xs px-3 py-1.5 rounded transition-colors ${rangeId === r.id ? 'bg-accent text-white' : 'btn-ghost'}`}
              >
                {r.label}
              </button>
            ))}
          </div>
          <button onClick={load} className="btn-ghost text-xs">↻ Refresh</button>
        </div>
      </div>

      {error && <p role="alert" className="text-danger">{error} <button onClick={load}>Retry</button></p>}
      {loading && <div className="text-xs text-muted">Loading…</div>}

      {!loading && !error && allRows.length === 0 && (
        <div className="card text-sm text-muted">
          No usage recorded yet. Start an agent through ACE and its sessions will show up here.
        </div>
      )}

      {!loading && !error && allRows.length > 0 && sessionCount === 0 && (
        <div className="card text-sm text-muted">No sessions in this time range. Try a wider range.</div>
      )}

      {!loading && !error && sessionCount > 0 && (
        <>
          <TokenEfficiencyCard efficiency={efficiency} />

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Sessions" value={sessionCount.toLocaleString()} sub={`in this range`} />
            <StatCard label="Median Prompts / Chat" value={medianPrompts ?? '—'} sub="messages per session" />
            <StatCard label="Median Tokens / Chat" value={medianTokens != null ? formatTokens(medianTokens) : '—'} sub="in + out + cache" />
            <StatCard label="Cost" value={`$${totalCost.toFixed(2)}`} sub="this range" color="text-warning" />
          </div>

          <FirstPromptCard stats={firstPrompt} series={firstPromptSeries} trackedSince={trackedSince} sessionCount={sessionCount} unit={unit} />

          {sessionCount < 3 && (
            <div className="card text-xs text-muted">
              Only {sessionCount} session{sessionCount === 1 ? '' : 's'} in this range. Trends below will
              smooth out as more usage is recorded.
            </div>
          )}

          <ChartCard title={`Token Consumption (by ${unit})`}>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={trend} margin={{ top: 4, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3a" />
                <XAxis dataKey="bucket" tick={chartTick} />
                <YAxis tick={chartTick} tickFormatter={formatTokens} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v) => formatTokens(v)} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="input" name="Input" stackId="tok" fill="#7c6af7" />
                <Bar dataKey="output" name="Output" stackId="tok" fill="#22c55e" />
                <Bar dataKey="cacheRead" name="Cache read" stackId="tok" fill="#3b82f6" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ChartCard title="Prompts per Chat">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={distribution} margin={{ top: 4, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3a" />
                  <XAxis dataKey="label" tick={chartTick} />
                  <YAxis tick={chartTick} allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="sessions" name="Sessions" fill="#7c6af7" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Model Cost Mix">
              <div className="flex items-center gap-4">
                <ResponsiveContainer width="50%" height={180}>
                  <PieChart>
                    <Pie data={mix.filter((m) => m.tokens > 0)} dataKey="tokens" nameKey="tier" innerRadius={40} outerRadius={70} paddingAngle={2}>
                      {mix.map((m) => <Cell key={m.tier} fill={TIER_COLOR[m.tier]} />)}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} formatter={(v, _n, p) => [formatTokens(v), TIER_LABEL[p.payload.tier]]} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1.5 flex-1">
                  {mix.map((m) => (
                    <div key={m.tier} className="flex items-center justify-between text-xs">
                      <span className={TIER_BADGE[m.tier]}>{TIER_LABEL[m.tier]}</span>
                      <span className="text-gray-300">{m.pct.toFixed(0)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </ChartCard>
          </div>

          <ModelTable tiers={tiers} />

          <ChartCard title="Cost Trend (USD)">
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={trend} margin={{ top: 4, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3a" />
                <XAxis dataKey="bucket" tick={chartTick} />
                <YAxis tick={chartTick} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`$${v.toFixed(4)}`, 'Cost']} />
                <Line type="monotone" dataKey="cost" stroke="#f59e0b" dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        </>
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

function TokenEfficiencyCard({ efficiency }) {
  const { score, factors } = efficiency
  const [showDetail, setShowDetail] = useState(false)
  const color = score == null ? 'text-muted' : score >= 70 ? 'text-success' : score >= 40 ? 'text-warning' : 'text-danger'

  return (
    <div className="card">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <div className="text-xs font-semibold text-muted uppercase tracking-wider mb-1">Token Efficiency Score</div>
          <div className={`text-4xl font-bold ${color}`}>{score == null ? '—' : score}</div>
          <div className="text-xs text-muted mt-1">
            {score == null ? 'Not enough usage in this range yet.' : 'out of 100 (weighted blend of cache reuse, cost trend, and model mix)'}
          </div>
        </div>
        <button onClick={() => setShowDetail((v) => !v)} className="btn-ghost text-xs">
          {showDetail ? 'Hide breakdown' : 'How is this calculated?'}
        </button>
      </div>

      <div className="mt-4 space-y-3">
        {factors.map((f) => (
          <div key={f.key}>
            <div className="flex items-baseline justify-between mb-1 gap-2">
              <span className="text-xs font-medium text-gray-300">{f.label} <span className="text-muted">({Math.round(f.weight * 100)}% weight)</span></span>
              <span className="text-xs text-gray-400">{f.score == null ? 'n/a' : `${Math.round(f.score)}/100`}</span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden bg-surface">
              <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${f.score ?? 0}%` }} />
            </div>
            {f.feedback && <div className={`text-xs mt-1 ${TONE_COLOR[f.feedback.tone]}`}>{f.feedback.message}</div>}
            {showDetail && <div className="text-xs text-muted mt-1">{f.detail}</div>}
          </div>
        ))}
      </div>

      {showDetail && (
        <div className="text-xs text-muted mt-4 pt-3 border-t border-border">
          Each factor is scored 0-100 and combined by weight. Cache reuse rewards resending less
          unchanged context; cost trend compares this range's $/1K tokens to the equal-length range
          before it; model mix rewards spending more tokens on the models that are cheapest in your
          own usage, not a fixed price list. Weights can be retuned later without changing what each
          factor measures.
        </div>
      )}
    </div>
  )
}

function FirstPromptCard({ stats, series, trackedSince, sessionCount, unit }) {
  if (!trackedSince && stats.count === 0) {
    return (
      <div className="card text-sm text-muted">
        <span className="font-medium text-gray-300">First-prompt length</span> isn't tracked yet.
        ACE started recording it as of this update. Open or continue a Claude agent through ACE and
        it will start appearing here.
      </div>
    )
  }

  const trackedDate = trackedSince ? new Date(trackedSince).toLocaleDateString() : null

  return (
    <ChartCard title="First-Prompt Length">
      <div className="flex items-baseline gap-6 mb-3">
        <div>
          <div className="text-2xl font-semibold text-gray-100">{stats.medianChars ?? '—'}</div>
          <div className="text-xs text-muted">median characters</div>
        </div>
        <div>
          <div className="text-2xl font-semibold text-gray-100">{stats.medianWords ?? '—'}</div>
          <div className="text-xs text-muted">median words</div>
        </div>
        <div className="text-xs text-muted">
          {stats.count} of {sessionCount} session{sessionCount === 1 ? '' : 's'} in range have data
          {trackedDate && <> (tracking since {trackedDate})</>}
        </div>
      </div>
      {series.length >= 2 ? (
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={series} margin={{ top: 4, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3a" />
            <XAxis dataKey="bucket" tick={chartTick} />
            <YAxis tick={chartTick} />
            <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${Math.round(v)} chars`, 'Median']} />
            <Line type="monotone" dataKey="medianChars" stroke="#7c6af7" dot strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <div className="text-xs text-muted">Not enough {unit}s with data yet for a trend line.</div>
      )}
    </ChartCard>
  )
}

function ModelTable({ tiers }) {
  return (
    <div className="card">
      <div className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Models Used</div>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-muted border-b border-border">
            <th className="text-left pb-2">Model</th>
            <th className="text-left pb-2">Cost tier</th>
            <th className="text-right pb-2">Tokens</th>
            <th className="text-right pb-2">Cost</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {tiers.map((m) => (
            <tr key={m.model}>
              <td className="py-1.5 text-gray-300">{m.model}</td>
              <td className="py-1.5"><span className={TIER_BADGE[m.tier]}>{TIER_LABEL[m.tier]}</span></td>
              <td className="text-right text-gray-400">{formatTokens(m.tokens)}</td>
              <td className="text-right text-warning">${m.cost.toFixed(4)}</td>
            </tr>
          ))}
          {tiers.length === 0 && (
            <tr><td colSpan={4} className="py-2 text-muted">No model usage in this range.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
