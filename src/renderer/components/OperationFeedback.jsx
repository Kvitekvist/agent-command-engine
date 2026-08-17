import React from 'react'

// TICKET-0050: shared progress/result strip for direct (no-AI) async actions
// (git/build in AgentTerminal.jsx, prerequisite installs in PrereqChecklist.jsx).
// `status` is null (nothing shown), or { type, message } where type is
// 'loading' | 'success' | 'error'. Loading renders an indeterminate animated
// bar (see globals.css) since npm/git give no real percentage; success/error
// render a single coloured line. Extracted from AgentTerminal.jsx (TICKET-0055)
// so the setup screen reuses the exact same pattern instead of duplicating it.
export default function OperationFeedback({ label, status }) {
  if (!status) return null
  return (
    <div className="px-1 pb-1 shrink-0">
      {status.type === 'loading' ? (
        // The animated label + bar carry no useful text to copy, and a click-
        // drag over them shouldn't start a selection, so keep them select-none.
        <div className="flex items-center gap-2 select-none">
          <span className="text-xs text-muted shrink-0">{label}…</span>
          <div className="progress-indeterminate h-1 flex-1 bg-border rounded-full" />
        </div>
      ) : (
        // Selectable on purpose: an error/success line is exactly the text a
        // user wants to highlight and copy (right-click Copy, TICKET-0051, or
        // Ctrl+C). select-text is stated explicitly so it survives regardless
        // of any surrounding select-none.
        <div className={`text-xs whitespace-pre-wrap break-words select-text ${status.type === 'success' ? 'text-success' : 'text-danger'}`}>
          <span className="font-medium">{label}: </span>
          {status.type === 'success' ? '✓ ' : '✗ '}
          {status.message}
        </div>
      )}
    </div>
  )
}
