import React, { useState } from 'react'
import PrereqChecklist from '../components/PrereqChecklist'

// TICKET-0055: shown on launch (and every subsequent launch, until
// dismissed) when the claude/codex CLIs ACE actually spawns aren't on PATH
// yet. Never installs anything without the user clicking a button -- see
// PrereqChecklist. "Continue to ACE" always works (this never hard-blocks
// the app -- someone using only one provider, or who'll install later,
// shouldn't be stuck), it just re-checks and reappears on the next launch
// unless "Don't show this again" is also checked.
export default function SetupView({ onContinue }) {
  const [dontShowAgain, setDontShowAgain] = useState(false)

  async function handleContinue() {
    if (dontShowAgain) {
      await window.ace.setSetting('prereqs_setup_dismissed', 'true')
    }
    onContinue()
  }

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-surface text-gray-100 p-6 overflow-auto">
      <div className="card w-full max-w-xl space-y-4">
        <div>
          <h1 className="text-lg font-semibold">Set up Agent Command Engine</h1>
          <p className="text-xs text-muted mt-1 leading-relaxed">
            ACE launches agents by running the real <code>claude</code>/<code>codex</code> CLIs
            directly. Install whichever ones are missing below, then sign in to each with{' '}
            <code>claude login</code> / <code>codex login</code> — in any terminal, or right here
            once an agent's terminal is open. That part's an interactive sign-in and can't be
            automated.
          </p>
        </div>

        <PrereqChecklist />

        <div className="flex items-center justify-between pt-2 border-t border-border">
          <label className="flex items-center gap-2 text-xs text-muted cursor-pointer select-none">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
            />
            Don't show this again
          </label>
          <button className="btn-primary text-xs" onClick={handleContinue}>
            Continue to ACE
          </button>
        </div>
      </div>
    </div>
  )
}
