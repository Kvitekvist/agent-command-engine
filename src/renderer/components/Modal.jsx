import React, { useEffect } from 'react'

// TICKET-0057: minimal reusable centered popup (backdrop + card, Escape and
// click-outside both close). ContextMenu.jsx is a different pattern (a
// cursor-anchored popover for right-click menus) -- this is the first
// generic "ask the user something in a real dialog" primitive in the app,
// needed because Electron doesn't implement window.prompt().
export default function Modal({ title, children, onClose }) {
  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div className="card w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        {title && <h2 className="text-sm font-semibold mb-3">{title}</h2>}
        {children}
      </div>
    </div>
  )
}
