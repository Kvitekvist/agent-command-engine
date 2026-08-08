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

// Mounted only while the agent is 'running' (see AgentView.jsx) -- unmount
// (Stop, or switching away from the project) disposes the PTY session in
// this effect's cleanup, which actually ends the interactive CLI process,
// not just hides the card. Re-mounting (Stop -> relaunch, or switching back
// to the project) always starts a brand-new session; an in-progress
// interactive conversation does not currently survive either of those,
// unlike the old standalone panel's "hidden but alive" behavior -- flagged
// as a known limitation in architecture.md rather than solved here.
export default function AgentTerminal({ agent }) {
  const containerRef = useRef(null)
  const sessionIdRef = useRef(null)
  const [status, setStatus] = useState('connecting') // connecting | ready | exited | error

  useEffect(() => {
    let disposed = false
    let unsubData
    let unsubExit
    let unsubHostRestarted

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
      const result = await window.cpi.terminal.spawn({ cols, rows, cwd: agent.projectPath })
      if (disposed) return
      if (!result.success) {
        setStatus('error')
        term.write(`\r\n\x1b[31mFailed to start terminal: ${result.error || 'unknown error'}\x1b[0m\r\n`)
        return
      }
      sessionIdRef.current = result.id
      setStatus('ready')

      unsubData = window.cpi.terminal.onData(({ id, chunk }) => {
        if (id === sessionIdRef.current) term.write(chunk)
      })
      unsubExit = window.cpi.terminal.onExit(({ id, exitCode }) => {
        if (id !== sessionIdRef.current) return
        setStatus('exited')
        term.write(`\r\n\x1b[90m[process exited with code ${exitCode}]\x1b[0m\r\n`)
      })
      unsubHostRestarted = window.cpi.terminal.onHostRestarted(() => {
        setStatus('exited')
        term.write('\r\n\x1b[31m[terminal process was lost -- stop and relaunch this agent to start a new session]\x1b[0m\r\n')
      })

      term.onData((data) => {
        if (sessionIdRef.current) window.cpi.terminal.write(sessionIdRef.current, data)
      })

      // Boot straight into the real CLI instead of leaving an empty shell.
      window.cpi.terminal.write(sessionIdRef.current, buildLaunchCommand(agent) + '\r')
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

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {(status === 'error' || status === 'exited') && (
        <div className="text-xs text-muted px-1 pb-1 shrink-0">
          {status === 'error' ? 'Failed to start terminal.' : 'Session ended.'}
        </div>
      )}
      <div className="flex-1 min-h-0 [&_.xterm]:h-full" ref={containerRef} />
    </div>
  )
}
