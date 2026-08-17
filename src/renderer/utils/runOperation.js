// TICKET-0050: run a direct (no-AI) async op, driving a status through
// loading -> success/error so the matching OperationFeedback strip shows a
// progress bar then a result. Guards against a second call while one is
// already in flight. Extracted from AgentTerminal.jsx (TICKET-0055) so
// PrereqChecklist.jsx reuses the exact same pattern instead of duplicating it.
export const OP_SUCCESS_CLEAR_MS = 6000

export async function runOperation(status, setStatus, label, invoke) {
  if (status?.type === 'loading') return
  setStatus({ type: 'loading' })
  try {
    const result = await invoke()
    if (result?.ok) {
      setStatus({ type: 'success', message: result.message || 'Done' })
      setTimeout(() => setStatus(null), OP_SUCCESS_CLEAR_MS)
    } else {
      setStatus({ type: 'error', message: result?.error || 'Failed' })
    }
  } catch (err) {
    setStatus({ type: 'error', message: err?.message || String(err) })
  }
}
