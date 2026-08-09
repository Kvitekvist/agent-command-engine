import React, { useEffect, useRef } from 'react'

// TICKET-0033: generic position-at-cursor context menu, closes on outside
// click or Escape. `items` is [{ label, onClick, disabled }] with an
// optional `{ divider: true }` entry to separate groups.
export default function ContextMenu({ x, y, items, onClose }) {
  const ref = useRef(null)

  useEffect(() => {
    function handlePointerDown(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose()
    }
    function handleKeyDown(e) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  return (
    <div
      ref={ref}
      style={{ top: y, left: x }}
      className="fixed z-50 min-w-[170px] rounded border border-border bg-panel py-1 text-xs shadow-lg"
    >
      {items.map((item, i) =>
        item.divider ? (
          <div key={i} className="my-1 border-t border-border" />
        ) : (
          <button
            key={i}
            disabled={item.disabled}
            onClick={() => {
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
