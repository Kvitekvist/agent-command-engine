import React from 'react'

export default function ModelSelector({ groups, value, onChange, className = '' }) {
  return (
    <select
      aria-label="Model"
      disabled={!groups.length}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`bg-surface border border-border rounded px-2 py-1 text-xs text-gray-200
                  focus:outline-none focus:border-accent cursor-pointer ${className}`}
    >
      {!groups.length && <option value="">No enabled models</option>}
      {groups.map((group) => (
        <optgroup key={group.label} label={group.label}>
          {group.options.map((model) => (
            <option key={model.id} value={model.id} title={model.description}>
              {model.label} — {model.description}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  )
}
