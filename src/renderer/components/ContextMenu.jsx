import React, { useEffect, useRef } from 'react'

// TICKET-0033: generic position-at-cursor context menu, closes on outside
// click or Escape. `items` is [{ label, onClick, disabled }] with an
// optional `{ divider: true }` entry to separate groups.
export default function ContextMenu({ x, y, items, onClose }) {
  const ref = useRef(null)
  const previousFocus = useRef(document.activeElement)
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    const buttons = () => [...ref.current.querySelectorAll('button:not(:disabled)')]
    buttons()[0]?.focus()
    function handlePointerDown(e) {
      if (ref.current && !ref.current.contains(e.target)) closeRef.current()
    }
    function handleKeyDown(e) {
      if (e.key === 'Escape' || e.key === 'Tab') closeRef.current()
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        const items = buttons()
        const next = items.indexOf(document.activeElement) + (e.key === 'ArrowDown' ? 1 : -1)
        items[(next + items.length) % items.length]?.focus()
      }
    }
    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
      if (previousFocus.current?.isConnected) previousFocus.current.focus()
    }
  }, [])

  return (
    <div
      ref={ref}
      role="menu"
      aria-label="Actions"
      style={{ top: y, left: x }}
      // Right-clicking inside the menu shouldn't open another context menu on
      // top of it (App.jsx's app-wide Copy/Paste menu would otherwise fire).
      onContextMenu={(e) => { e.preventDefault(); e.stopPropagation() }}
      className="fixed z-50 min-w-[170px] rounded border border-border bg-panel py-1 text-xs shadow-lg"
    >
      {items.map((item, i) =>
        item.divider ? (
          <div key={i} className="my-1 border-t border-border" />
        ) : (
          <button
            key={i}
            role="menuitem"
            disabled={item.disabled}
            onClick={() => {
              previousFocus.current?.focus()
              onClose()
              item.onClick()
            }}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-gray-300 hover:bg-border disabled:opacity-40 disabled:hover:bg-transparent"
          >
            {item.label}
          </button>
        )
      )}
    </div>
  )
}
