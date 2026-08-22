import React from 'react'

export default function ModelSelector({ groups, value, onChange, className = '' }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`bg-surface border border-border rounded px-2 py-1 text-xs text-gray-200
                  focus:outline-none focus:border-accent cursor-pointer ${className}`}
    >
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
