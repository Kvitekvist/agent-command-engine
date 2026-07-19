import React from 'react'

export default function ModelSelector({ models, value, onChange, className = '' }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`bg-surface border border-border rounded px-2 py-1 text-xs text-gray-200
                  focus:outline-none focus:border-accent cursor-pointer ${className}`}
    >
      {models.map((m) => (
        <option key={m} value={m}>{m}</option>
      ))}
    </select>
  )
}
