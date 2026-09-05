import React, { useState } from 'react'
import useStore from '../store/useStore'
import { formatReset, formatTokens, METRIC_LABELS } from './UsageCard'
import claudeIcon from '../assets/icons/claude.svg?raw'
import codexIcon from '../assets/icons/codex.svg?raw'

// TICKET-0023: compact second presentation of the same live quota data
// UsageCard.jsx shows in full on the Token Usage tab -- same tokscale-backed
// `liveUsage` store slice (polled once, from App.jsx), just the primary
// quota metric (Claude: 5-hour rolling, Codex: Weekly -- whichever
// getLiveTokenUsage() returns first) rendered as one slim row per provider
// instead of a whole card.
const PROVIDERS = [
  { key: 'claude', name: 'Claude', icon: claudeIcon, color: '#d97757' },
  { key: 'codex', name: 'Codex', icon: codexIcon, color: '#3b82f6' },
]

const STORAGE_KEY = 'ace-usage-show-tokens'

export default function UsageBar() {
  const { liveUsage, liveUsageLoading } = useStore()
  const [showRemaining, setShowRemaining] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) === 'true' } catch { return false }
  })

  const toggle = () => {
    const next = !showRemaining
    setShowRemaining(next)
    try { localStorage.setItem(STORAGE_KEY, String(next)) } catch {}
  }

  if (liveUsageLoading) return null

  return (
    <div className="flex items-center gap-6 px-5 py-2 border-b border-border bg-panel text-xs flex-wrap">
      {PROVIDERS.map((p) => (
        <ProviderUsage key={p.key} {...p} data={liveUsage?.[p.key]} showRemaining={showRemaining} onToggle={toggle} />
      ))}
    </div>
  )
}

function ProviderUsage({ name, icon, color, data, showRemaining, onToggle }) {
  const primary = data?.quota?.[0]
  const used = primary ? Math.max(0, Math.min(100, Number(primary.used_percent) || 0)) : null
  const available = primary
    ? Math.max(0, Math.min(100, primary.remaining_percent != null ? Number(primary.remaining_percent) : 100 - used))
    : null
  const reset = primary ? formatReset(primary.resets_at) : null
  const metricLabel = primary ? (METRIC_LABELS[primary.label] || primary.label) : null

  // Enterprise/unlimited plan: no quota or no valid percentages
  const hasValidQuota = data?.quota?.length > 0 && data.quota.some(m => m.used_percent != null)
  const isUnlimited = !data?.quotaError && !hasValidQuota

  return (
    <div className="flex items-center gap-2 min-w-0" title={metricLabel || undefined}>
      <button
        type="button"
        onClick={onToggle}
        className="w-3.5 h-3.5 shrink-0 [&_svg]:w-full [&_svg]:h-full bg-transparent border-none p-0 cursor-pointer hover:opacity-80"
        style={{ color }}
        dangerouslySetInnerHTML={{ __html: icon }}
        title="Click to toggle used/remaining"
      />
      <span className="font-medium text-gray-300 shrink-0">{name}</span>
      {data?.quotaError ? (
        <span className="text-muted">no quota data</span>
      ) : isUnlimited ? (
        <>
          <span className="text-gray-100 font-medium shrink-0">{formatTokens(data.totalTokens || 0)} tokens</span>
          <span className="text-muted shrink-0">·</span>
          <span className="text-warning shrink-0">${(data.totalCost || 0).toFixed(2)}</span>
        </>
      ) : !primary ? (
        <span className="text-muted">no quota data</span>
      ) : (
        <>
          <div className="w-14 h-1.5 rounded-full overflow-hidden shrink-0" style={{ background: `${color}29` }}>
            <div className="h-full rounded-full" style={{ width: `${used}%`, background: color }} />
          </div>
          <span className="font-medium shrink-0" style={{ color: showRemaining ? '#9ca3af' : '#f3f4f6' }}>
            {showRemaining ? `${Math.round(available)}% remaining` : `${Math.round(used)}% used`}
          </span>
          {reset && (
            <>
              <span className="text-muted shrink-0">·</span>
              <span className="text-muted shrink-0">resets in {reset}</span>
            </>
          )}
        </>
      )}
    </div>
  )
}
