import React, { useEffect, useRef, useState } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { buildLaunchCommand } from '../utils/agentLaunch'

// TICKET-0019 (correction): each agent card embeds its own live PTY session
// running the real interactive `claude`/`codex` CLI, instead of the
// headless chat-bubble thread this component replaces. Reuses the same
// `window.cpi.terminal.*` multi-session API TerminalPanel.jsx used to power
// a single standalone shell -- ptyHost.js already keys sessions by id, so
// nothing on the backend changed to support many concurrent sessions here.
const XTERM_THEME = {
  background: '#0f1117', // surface
  foreground: '#f3f4f6',
  cursor: '#7c6af7', // accent
  selectionBackground: '#6858e0', // accent-hover
}

// The real CLI prints its own splash (account info, "What's new", tips) on
// every fresh launch -- and every AgentTerminal mount is a fresh launch, so
// it reappears on every tab/project switch back to an already-running
// agent, not just a genuine first launch. There's no CLI flag to suppress
// it (checked `claude --help`/`codex --help` and the bundled CLI's own
// known env vars). Hidden behind a loading overlay for a fixed delay, then
// wiped with a local xterm.js clear() (display-only -- doesn't touch the
// real process), so the card reveals straight into the live, already-clean
// session. Timing-based rather than content-matched on purpose: the splash
// text differs between Claude and Codex and across CLI versions, and a
// fixed delay degrades gracefully (worst case: a brief flash) instead of
// silently hanging forever if a future CLI version changes its output.
const LAUNCH_BANNER_HIDE_MS = 1200

// Mounted only while the agent is 'running' (see AgentView.jsx) -- unmount
// (Stop, or Delete) disposes the PTY session in this effect's cleanup,
// which actually ends the interactive CLI process, not just hides the
// card. Re-mounting after Stop -> relaunch always starts a brand-new
// session. Switching away from the project no longer unmounts this
// component (TICKET-0030): AgentView.jsx keeps every agent's card mounted
// across every visited project, hiding non-active ones with CSS instead of
// unmounting them -- the same hide-not-unmount pattern TICKET-0027 already
// used for tab switches. So an in-progress interactive session now
// survives a project switch the same way it already survived a tab
// switch; only Stop/Delete/app quit end it.
export default function AgentTerminal({ agent }) {
  const containerRef = useRef(null)
  const sessionIdRef = useRef(null)
  const [status, setStatus] = useState('connecting') // connecting | ready | exited | error
  const [showBanner, setShowBanner] = useState(true)
  // TICKET-0039: mirrors the global 'auto_accept_permissions' setting at
  // spawn time (unchanged), but can now also be flipped live for just this
  // session -- ptyHost.js no longer requires a respawn to pick it up, so a
  // prompt that's already on screen when this is toggled on gets answered
  // immediately instead of only affecting the *next* agent launch.
  const [autoAnswer, setAutoAnswer] = useState(false)

  useEffect(() => {
    let disposed = false
    let unsubData
    let unsubExit
    let unsubHostRestarted
    let hideBannerTimer

    // Used when the session errors or exits before the timed reveal fires --
    // don't leave the error/exit message hidden behind the overlay.
    function revealImmediately() {
      clearTimeout(hideBannerTimer)
      setShowBanner(false)
    }

    const term = new Terminal({
      convertEol: true,
      fontSize: 13,
      fontFamily: "Consolas, 'Cascadia Mono', 'Courier New', monospace",
      theme: XTERM_THEME,
      cursorBlink: true,
      scrollback: 5000,
    })
    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    term.open(containerRef.current)
    fitAddon.fit()

    async function start() {
      const { cols, rows } = term
      // Load auto-answer setting
      const autoAnswerEnabled = await window.cpi.getSetting('auto_accept_permissions')
      const initialAutoAnswer = autoAnswerEnabled === 'true'
      const result = await window.cpi.terminal.spawn({
        cols,
        rows,
        cwd: agent.projectPath,
        autoAnswerPermissions: initialAutoAnswer
      })
      if (disposed) return
      if (!result.success) {
        setStatus('error')
        term.write(`\r\n\x1b[31mFailed to start terminal: ${result.error || 'unknown error'}\x1b[0m\r\n`)
        revealImmediately()
        return
      }
      sessionIdRef.current = result.id
      setStatus('ready')
      setAutoAnswer(initialAutoAnswer)

      unsubData = window.cpi.terminal.onData(({ id, chunk }) => {
        if (id === sessionIdRef.current) term.write(chunk)
      })
      unsubExit = window.cpi.terminal.onExit(({ id, exitCode }) => {
        if (id !== sessionIdRef.current) return
        setStatus('exited')
        term.write(`\r\n\x1b[90m[process exited with code ${exitCode}]\x1b[0m\r\n`)
        revealImmediately()
      })
      unsubHostRestarted = window.cpi.terminal.onHostRestarted(() => {
        setStatus('exited')
        term.write('\r\n\x1b[31m[terminal process was lost -- stop and relaunch this agent to start a new session]\x1b[0m\r\n')
        revealImmediately()
      })

      term.onData((data) => {
        if (sessionIdRef.current) window.cpi.terminal.write(sessionIdRef.current, data)
      })

      // Enable clipboard support - Ctrl+C to copy, Ctrl+V to paste
      term.attachCustomKeyEventHandler((event) => {
        // Ctrl+C - copy selected text
        if (event.ctrlKey && event.key === 'c' && term.hasSelection()) {
          const selection = term.getSelection()
          navigator.clipboard.writeText(selection)
          return false // Prevent default
        }
        // Ctrl+V - paste from clipboard
        if (event.ctrlKey && event.key === 'v' && event.type === 'keydown') {
          navigator.clipboard.readText().then(text => {
            if (sessionIdRef.current) window.cpi.terminal.write(sessionIdRef.current, text)
          })
          return false // Prevent default
        }
        return true // Allow all other keys
      })

      // Right-click paste support
      containerRef.current.addEventListener('contextmenu', (e) => {
        e.preventDefault()
        navigator.clipboard.readText().then(text => {
          if (sessionIdRef.current) window.cpi.terminal.write(sessionIdRef.current, text)
        })
      })

      // Boot straight into the real CLI instead of leaving an empty shell.
      window.cpi.terminal.write(sessionIdRef.current, buildLaunchCommand(agent) + '\r')

      // See LAUNCH_BANNER_HIDE_MS above -- wipe the CLI's own splash once
      // it's had time to render, then reveal the already-clean session.
      hideBannerTimer = setTimeout(() => {
        if (disposed) return
        term.clear()
        setShowBanner(false)
      }, LAUNCH_BANNER_HIDE_MS)
    }
    start()

    const resizeObserver = new ResizeObserver(() => {
      try {
        fitAddon.fit()
        const { cols, rows } = term
        if (sessionIdRef.current) window.cpi.terminal.resize(sessionIdRef.current, cols, rows)
      } catch (_) { /* container mid-teardown */ }
    })
    resizeObserver.observe(containerRef.current)

    return () => {
      disposed = true
      clearTimeout(hideBannerTimer)
      resizeObserver.disconnect()
      unsubData?.()
      unsubExit?.()
      unsubHostRestarted?.()
      if (sessionIdRef.current) window.cpi.terminal.dispose(sessionIdRef.current)
      term.dispose()
    }
    // Intentionally empty deps -- this effect owns one PTY session for the
    // component's entire mounted lifetime (one agent, one session), not
    // per-render. agent.projectPath/provider/model/permissionMode are all
    // fixed at launch time for a given mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // TICKET-0039: flips ptyHost's live per-session flag (no respawn needed)
  // so this takes effect on whatever prompt is on screen right now, not
  // just future ones.
  function toggleAutoAnswer() {
    if (!sessionIdRef.current) return
    const next = !autoAnswer
    setAutoAnswer(next)
    window.cpi.terminal.setAutoAnswer(sessionIdRef.current, next)
  }

  // Manual escape hatch: submits the already-selected "1. Yes" option
  // directly, independent of whether prompt detection fired. Useful the
  // moment a prompt is visibly stuck, regardless of the auto-answer toggle.
  function approveNow() {
    if (sessionIdRef.current) window.cpi.terminal.write(sessionIdRef.current, '\r')
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col relative">
      {(status === 'error' || status === 'exited') && (
        <div className="text-xs text-muted px-1 pb-1 shrink-0">
          {status === 'error' ? 'Failed to start terminal.' : 'Session ended.'}
        </div>
      )}
      {status === 'ready' && (
        <div className="flex items-center gap-1.5 px-1 pb-1 shrink-0">
          <button
            onClick={toggleAutoAnswer}
            title="Auto-confirm permission prompts in this terminal, without needing to stop and relaunch the agent"
            className={`text-xs py-0.5 px-2 rounded border transition-colors
              ${autoAnswer
                ? 'border-accent/40 bg-accent/20 text-accent'
                : 'border-border text-muted hover:bg-border'}`}>
            {autoAnswer ? '🛡️ Auto-approve: On' : '🛡️ Auto-approve: Off'}
          </button>
          <button
            onClick={approveNow}
            title="Immediately confirm 'Yes' on whatever permission prompt is currently showing"
            className="text-xs py-0.5 px-2 rounded border border-border text-muted hover:bg-border transition-colors">
            ✅ Approve now
          </button>
        </div>
      )}
      <div className="flex-1 min-h-0 [&_.xterm]:h-full" ref={containerRef} />
      {showBanner && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-surface text-muted text-xs gap-1">
          <div className="text-lg">⚡</div>
          <div>Launching {agent.label}…</div>
        </div>
      )}
    </div>
  )
}
