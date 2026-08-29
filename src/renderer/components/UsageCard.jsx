import React from 'react'

// TICKET-0022: compact "384K" / "99.2M" style, matching the reference
// design (token-monitor) rather than a raw digit count.
export function formatTokens(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K'
  return String(Math.round(n))
}

export function formatReset(resetsAt) {
  if (!resetsAt) return null
  const ms = new Date(resetsAt).getTime() - Date.now()
  if (!Number.isFinite(ms)) return null
  if (ms <= 0) return 'now'
  const totalMinutes = Math.floor(ms / 60000)
  const days = Math.floor(totalMinutes / (60 * 24))
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60)
  const minutes = totalMinutes % 60
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

// tokscale's `usage --json` labels quota windows "Session" (Claude's
// 5-hour rolling limit) and "Weekly" -- Codex only ever reports "Weekly".
export const METRIC_LABELS = { Session: '5-hour rolling', Weekly: 'Weekly' }

export default function UsageCard({ name, iconSvg, color, data }) {
  const { plan, quota = [], models = [], projects = [], totalTokens = 0, totalCost = 0, quotaError, breakdownError } = data || {}

  // Enterprise/unlimited plan detection: no quota metrics or all metrics lack percentages
  const hasValidQuota = quota.length > 0 && quota.some(m => m.used_percent != null)
  const isUnlimited = !quotaError && !hasValidQuota

  return (
    <div className="card">
      <div className="flex items-center gap-3 mb-4">
        <span
          className="w-7 h-7 shrink-0 [&_svg]:w-full [&_svg]:h-full"
          style={{ color }}
          dangerouslySetInnerHTML={{ __html: iconSvg }}
        />
        <div className="min-w-0">
          <div className="text-base font-semibold text-gray-100">{name}</div>
          <div className="text-xs text-muted truncate">Live usage · today{plan ? ` · ${plan}` : ''}</div>
        </div>
      </div>

      {quotaError ? (
        <div className="text-xs text-muted mb-4">Quota unavailable — {quotaError}</div>
      ) : isUnlimited ? (
        <div className="space-y-2 mb-4">
          <div className="text-xs font-medium text-gray-300">Usage today</div>
          <div className="flex items-baseline gap-3">
            <div>
              <div className="text-2xl font-bold text-gray-100">{formatTokens(totalTokens)}</div>
              <div className="text-xs text-muted">tokens</div>
            </div>
            <div className="text-muted">·</div>
            <div>
              <div className="text-2xl font-bold text-warning">${totalCost.toFixed(2)}</div>
              <div className="text-xs text-muted">cost</div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-3 mb-4">
          {quota.map((m) => {
            const pct = Math.max(0, Math.min(100, Number(m.used_percent) || 0))
            const reset = formatReset(m.resets_at)
            return (
              <div key={m.label}>
                <div className="flex items-baseline justify-between mb-1 gap-2">
                  <span className="text-xs font-medium text-gray-300 shrink-0">{METRIC_LABELS[m.label] || m.label}</span>
                  <span className="text-sm font-semibold text-gray-100 whitespace-nowrap">
                    {Math.round(pct)}%
                    {reset && <span className="text-xs text-muted font-normal ml-1.5">resets in {reset}</span>}
                  </span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: `${color}29` }}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <div className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Models</div>
          <div className="space-y-1.5">
            {models.slice(0, 4).map((m) => (
              <div key={m.name} className="bg-surface rounded px-2 py-1.5">
                <div className="text-xs text-gray-300 truncate" title={m.name}>{m.name}</div>
                <div className="text-sm font-semibold text-gray-100">{formatTokens(m.tokens)}</div>
              </div>
            ))}
            {models.length === 0 && !breakdownError && <div className="text-xs text-muted">No usage today.</div>}
          </div>
        </div>
        <div>
          <div className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Today by project</div>
          <div className="grid grid-cols-2 gap-1.5">
            {projects.slice(0, 4).map((p) => (
              <div key={p.fullName || p.name} className="bg-surface rounded px-2 py-1.5">
                <div className="text-xs text-gray-300 truncate" title={p.fullName || p.name}>{p.name}</div>
                <div className="text-sm font-semibold text-gray-100">{formatTokens(p.tokens)}</div>
              </div>
            ))}
            {projects.length === 0 && !breakdownError && <div className="text-xs text-muted col-span-2">No usage today.</div>}
          </div>
        </div>
      </div>

      {breakdownError && <div className="text-xs text-muted mb-3">Today's breakdown unavailable — {breakdownError}</div>}

      <div className="pt-3 border-t border-border">
        <div className="text-xs font-semibold text-muted uppercase tracking-wider">Tokens used</div>
        <div className="text-3xl font-bold text-gray-100 leading-tight">{formatTokens(totalTokens)}</div>
        <div className="text-xs text-muted">{Math.round(totalTokens).toLocaleString()} tokens</div>
      </div>
    </div>
  )
}
