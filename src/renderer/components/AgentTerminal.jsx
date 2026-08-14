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

// How long a successful operation's confirmation lingers before auto-clearing.
// Errors are sticky (no timer) so the user can actually read what failed.
const OP_SUCCESS_CLEAR_MS = 6000

// TICKET-0050: shared progress/result strip for the direct (no-AI) git/build
// actions. `status` is null (nothing shown), or { type, message } where type is
// 'loading' | 'success' | 'error'. Loading renders an indeterminate animated
// bar (see globals.css) since npm/git give no real percentage; success/error
// render a single coloured line.
function OperationFeedback({ label, status }) {
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
  const terminalRef = useRef(null)
  const sessionIdRef = useRef(null)
  const [status, setStatus] = useState('connecting') // connecting | ready | exited | error
  const [showBanner, setShowBanner] = useState(true)
  // TICKET-0039: per-agent only, no global setting -- defaults off (silently
  // auto-confirming every permission prompt shouldn't be on without an
  // explicit per-agent opt-in) and can be flipped live via the pill below;
  // ptyHost.js acts on it immediately, no respawn needed, so a prompt
  // that's already on screen when this is toggled on gets answered too.
  const [autoAnswer, setAutoAnswer] = useState(false)
  const [canBuild, setCanBuild] = useState(false)
  // Operation feedback state
  const [commitPushStatus, setCommitPushStatus] = useState(null) // { type: 'loading' | 'success' | 'error', message: string }
  const [pullStatus, setPullStatus] = useState(null)
  const [buildStatus, setBuildStatus] = useState(null)

  // Check if the project can build executables. fs.readFile resolves to
  // { ok, content } (or { ok:false, reason } -- see FileService.readFile), NOT
  // a raw string, so we read .content and check .ok. ACE keeps its own
  // package.json under src/, so try there first, then the project root.
  useEffect(() => {
    async function readPkg(relPath) {
      try {
        const res = await window.cpi.fs.readFile(agent.projectPath, relPath)
        return res?.ok ? res.content : null
      } catch (_) {
        return null
      }
    }
    async function checkBuildCapability() {
      try {
        const pkgContent = (await readPkg('src/package.json')) || (await readPkg('package.json'))
        if (!pkgContent) {
          setCanBuild(false)
          return
        }
        const pkg = JSON.parse(pkgContent)
        // Buildable = an Electron app with a win/mac build target and a package script.
        setCanBuild(!!(
          pkg.build &&
          (pkg.build.win || pkg.build.mac) &&
          pkg.scripts &&
          (pkg.scripts.package || pkg.scripts.build)
        ))
      } catch (_) {
        setCanBuild(false)
      }
    }
    checkBuildCapability()
  }, [agent.projectPath])

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
    // Store terminal instance for focus restoration
    terminalRef.current = term
    // Ensure terminal has focus for keyboard input
    term.focus()

    async function start() {
      const { cols, rows } = term
      // Auto-answer starts off for every new session -- see the state
      // comment above. Use the 🛡️ Auto-approve pill to turn it on.
      const result = await window.cpi.terminal.spawn({
        cols,
        rows,
        cwd: agent.projectPath,
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

      // Right-click paste support. stopPropagation keeps the app-wide
      // Copy/Paste context menu (TICKET-0051, wired in App.jsx) from also
      // firing over the terminal -- the terminal owns its own copy (Ctrl+C
      // on a selection) and paste (right-click / Ctrl+V) behaviour.
      containerRef.current.addEventListener('contextmenu', (e) => {
        e.preventDefault()
        e.stopPropagation()
        navigator.clipboard.readText().then(text => {
          if (sessionIdRef.current) window.cpi.terminal.write(sessionIdRef.current, text)
        })
      })

      // TICKET-0044: force a known CLI session id for Claude agents so their
      // tokscale usage can be attributed to this agent's name in the Token
      // Usage "By Agent" breakdown. Codex has no equivalent flag, so it keeps
      // its own auto-generated session and stays "Untracked" there.
      const cliSessionId = agent.provider === 'codex' ? null : crypto.randomUUID()
      if (cliSessionId) {
        window.cpi.recordAgentSession({
          session_id: cliSessionId,
          agent_id: agent.agentId,
          project_id: agent.projectId,
          label: agent.label,
        })
      }

      // Boot straight into the real CLI instead of leaving an empty shell.
      window.cpi.terminal.write(sessionIdRef.current, buildLaunchCommand(agent, cliSessionId) + '\r')

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

  // TICKET-0050: run a direct (no-AI) git/build op, driving one of the status
  // states through loading -> success/error so the matching OperationFeedback
  // strip shows a progress bar then a result. Guards against a second click
  // while the op is in flight (the caller also disables the button).
  async function runOperation(status, setStatus, label, invoke) {
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

  return (
    <div className="flex-1 min-h-0 flex flex-col relative">
      {(status === 'error' || status === 'exited') && (
        <div className="text-xs text-muted px-1 pb-1 shrink-0">
          {status === 'error' ? 'Failed to start terminal.' : 'Session ended.'}
        </div>
      )}
      {status === 'ready' && (
        <div className="flex items-center gap-1.5 px-1 pb-1 shrink-0 flex-wrap">
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
            disabled={commitPushStatus?.type === 'loading'}
            onClick={() => runOperation(
              commitPushStatus, setCommitPushStatus, 'Commit & Push',
              () => window.cpi.git.commitAndPush(agent.projectPath),
            )}
            title="Commit and push changes directly (no AI)"
            className="text-xs py-0.5 px-2 rounded border border-border text-muted hover:bg-border transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            ⬆️ Commit & Push
          </button>
          <button
            disabled={pullStatus?.type === 'loading'}
            onClick={() => runOperation(
              pullStatus, setPullStatus, 'Pull',
              () => window.cpi.git.pull(agent.projectPath),
            )}
            title="Pull changes from remote (no AI)"
            className="text-xs py-0.5 px-2 rounded border border-border text-muted hover:bg-border transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            ⬇️ Pull
          </button>
          {canBuild && (
            <button
              disabled={buildStatus?.type === 'loading'}
              onClick={() => runOperation(
                buildStatus, setBuildStatus, 'Build',
                () => window.cpi.project.build(agent.projectPath),
              )}
              title="Build this project (runs its npm build script, no AI)"
              className="text-xs py-0.5 px-2 rounded border border-border text-muted hover:bg-border transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              🔨 Build
            </button>
          )}
          <button
            onClick={() => {
              if (sessionIdRef.current) {
                window.cpi.terminal.write(sessionIdRef.current, '/calibrate\r')
              }
            }}
            title="Run /calibrate to review and improve session patterns"
            className="text-xs py-0.5 px-2 rounded border border-border text-muted hover:bg-border transition-colors">
            🎯 Calibrate
          </button>
          <button
            onClick={() => {
              if (sessionIdRef.current) {
                window.cpi.terminal.write(sessionIdRef.current, '/clear\r')
              }
            }}
            title="Clear the conversation context"
            className="text-xs py-0.5 px-2 rounded border border-border text-muted hover:bg-border transition-colors">
            🧹 Clear
          </button>
        </div>
      )}
      {/* TICKET-0050: progress + success/fail feedback for the direct git/build actions */}
      <OperationFeedback label="Commit & Push" status={commitPushStatus} />
      <OperationFeedback label="Pull" status={pullStatus} />
      <OperationFeedback label="Build" status={buildStatus} />
      <div
        className="flex-1 min-h-0 [&_.xterm]:h-full"
        ref={containerRef}
        onClick={() => {
          // Refocus terminal when clicking anywhere in the terminal area
          // to restore keyboard input if focus was lost
          if (terminalRef.current) terminalRef.current.focus()
        }}
      />
      {showBanner && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-surface text-muted text-xs gap-1">
          <div className="text-lg">⚡</div>
          <div>Launching {agent.label}…</div>
        </div>
      )}
    </div>
  )
}
