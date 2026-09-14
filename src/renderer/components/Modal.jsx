import React, { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'

// TICKET-0057: minimal reusable centered popup (backdrop + card, Escape and
// click-outside both close). ContextMenu.jsx is a different pattern (a
// cursor-anchored popover for right-click menus) -- this is the first
// generic "ask the user something in a real dialog" primitive in the app,
// needed because Electron doesn't implement window.prompt().
export default function Modal({ title, children, onClose, wide, className = '' }) {
  const titleId = useId()
  const dialogRef = useRef(null)
  const previousFocus = useRef(document.activeElement)
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useEffect(() => {
    const previous = previousFocus.current
    const dialog = dialogRef.current
    const siblings = [...document.body.children].filter(element => element !== dialog.parentElement)
    const inertStates = siblings.map(element => element.inert)
    siblings.forEach(element => { element.inert = true })
    const controls = () => [...dialog.querySelectorAll('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex="0"]')].filter(element => element.getClientRects().length && !element.closest('[inert]'))
    ;(dialog.querySelector('[autofocus], input, textarea') || controls()[0] || dialog).focus()
    function onKeyDown(e) {
      if (dialog.parentElement.inert) return
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeRef.current() }
      if (e.key === 'Tab') {
        const items = controls()
        const first = items[0] || dialog
        const last = items[items.length - 1] || dialog
        if (e.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) { e.preventDefault(); last.focus() }
        else if (!e.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) { e.preventDefault(); first.focus() }
      }
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => {
      window.removeEventListener('keydown', onKeyDown, true)
      siblings.forEach((element, index) => { element.inert = inertStates[index] })
      if (previous?.isConnected) previous.focus()
    }
  }, [])

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} className={`card w-full relative max-h-[90vh] overflow-auto ${wide ? 'max-w-lg' : 'max-w-sm'} ${className}`} onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onClose}
          title="Close"
          aria-label="Close dialog"
          className="absolute top-2 right-2 text-red-500 hover:text-red-400 text-lg leading-none w-6 h-6 flex items-center justify-center">
          ✕
        </button>
        <h2 id={titleId} className="text-sm font-semibold mb-3 pr-6">{title || 'Dialog'}</h2>
        {children}
      </div>
    </div>, document.body
  )
}
