import React, { useEffect, useRef, useState } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import '@xterm/xterm/css/xterm.css'
import { feedLineCapture, deriveTitle } from '../utils/firstLineCapture.mjs'
import { buildImageGenerationPrompt } from '../utils/imageGenerationPrompt.mjs'
import { buildFirstPrompt } from '../utils/firstPromptQuestionnaire.mjs'
import { readPasteText, pasteImage } from '../utils/terminalPaste.mjs'
import { findFileLinks, openTerminalLink } from '../utils/terminalLinks.mjs'
import OperationFeedback from './OperationFeedback'
import NotesPanel from './NotesPanel'
import Modal from './Modal'
import useStore from '../store/useStore'

// TICKET-0019 (correction): each agent card embeds its own live PTY session
// running the real interactive `claude`/`codex` CLI, instead of the
// headless chat-bubble thread this component replaces. Reuses the same
// `window.ace.terminal.*` multi-session API TerminalPanel.jsx used to power
// a single standalone shell -- ptyHost.js already keys sessions by id, so
// nothing on the backend changed to support many concurrent sessions here.
const XTERM_THEME = {
  background: '#0f1117', // surface
  foreground: '#f3f4f6',
  cursor: '#7c6af7', // accent
  selectionBackground: '#6858e0', // accent-hover
}

// Both link sources below (WebLinksAddon for URLs, the custom provider for
// file paths) open on a plain click, which is one accidental click away from
// firing while a user is just selecting/dragging over terminal text -- so
// activation requires Alt+click, and this tooltip is the only way a user
// would otherwise know that. One shared DOM element (not React state --
// these hover/leave callbacks fire straight from xterm, outside React) that
// follows the cursor while any link is hovered.
let linkTooltipEl = null
function showLinkTooltip(event) {
  if (!linkTooltipEl) {
    linkTooltipEl = document.createElement('div')
    linkTooltipEl.className = 'xterm-hover'
    linkTooltipEl.textContent = 'Alt+Click to open'
    Object.assign(linkTooltipEl.style, {
      position: 'fixed',
      zIndex: 9999,
      pointerEvents: 'none',
      background: '#1c1e2a',
      color: '#f3f4f6',
      border: '1px solid #2a2d3a',
      borderRadius: '4px',
      padding: '2px 6px',
      fontSize: '11px',
      fontFamily: 'Inter, sans-serif',
    })
    document.body.appendChild(linkTooltipEl)
  }
  linkTooltipEl.style.left = `${event.clientX + 12}px`
  linkTooltipEl.style.top = `${event.clientY + 12}px`
}
function hideLinkTooltip() {
  linkTooltipEl?.remove()
  linkTooltipEl = null
}

// The real CLI prints its own splash (account info, "What's new", tips) on
// every fresh launch. Reattachment replays main's output without launching
// another CLI or masking its terminal. There's no CLI flag to suppress
// it (checked `claude --help`/`codex --help` and the bundled CLI's own
// known env vars). Hidden behind a loading overlay for a fixed delay, then
// revealed. TICKET-0102: the reveal used to also wipe the screen with a
// local xterm.js clear(); that discarded the CLI's Welcome box (cwd, model,
// tips) on macOS, where a login shell and slower rendering put the box above
// the current line at wipe time. Per user decision the Welcome box is kept,
// so the overlay alone masks boot churn. Timing-based rather than
// content-matched on purpose: the splash text differs between Claude and
// Codex and across CLI versions, and a fixed delay degrades gracefully
// (worst case: a brief flash) instead of silently hanging forever if a
// future CLI version changes its output. macOS needs longer because it
// spawns the CLI through a login shell.
const IS_MAC = window.ace?.platform === 'darwin'
const LAUNCH_BANNER_HIDE_MS = IS_MAC ? 2000 : 1200

// Main owns the PTY. Component cleanup only detaches listeners and xterm;
// remount reattaches to the same session. Explicit Stop/Delete/app quit end it.
export default function AgentTerminal({ agent, onStatusChange }) {
  const containerRef = useRef(null)
  const terminalRef = useRef(null)
  const sessionIdRef = useRef(null)
  // Auto-title -- captures the first non-empty line the user submits into
  // this terminal and turns it into the card's session title. Skipped entirely
  // (ref starts true) for an agent restored with an already-set title, so a
  // follow-up line typed after a restore doesn't clobber it.
  const titleCapturedRef = useRef(!!agent.hasSessionTitle)
  const titleBufferRef = useRef('')
  const [status, setStatus] = useState('connecting') // connecting | ready | exited | error
  // PTY lifecycle only. What the agent is *doing* (Running / Waiting) is driven
  // separately by Claude's lifecycle hooks -- see HookService.js and AgentView.
  const updateStatus = (newStatus) => {
    setStatus(newStatus)
    onStatusChange?.(newStatus)
  }
  const [showBanner, setShowBanner] = useState(true)
  // TICKET-0039: per-agent only, no global setting -- defaults off (silently
  // auto-confirming every permission prompt shouldn't be on without an
  // explicit per-agent opt-in) and can be flipped live via the pill below;
  // ptyHost.js acts on it immediately, no respawn needed, so a prompt
  // that's already on screen when this is toggled on gets answered too.
  const [autoAnswer, setAutoAnswer] = useState(false)
  // Operation feedback state
  const [pasteStatus, setPasteStatus] = useState(null) // For large paste feedback
  const [showNotes, setShowNotes] = useState(false)
  const [skills, setSkills] = useState({})
  useEffect(() => {
    if (status !== 'ready' || agent.provider !== 'claude') return
    let cancelled = false
    Promise.all(['push-update', 'calibrate-enhanced'].map(async name => {
      const result = await window.ace.fs.readFile(agent.projectPath, `.claude/skills/${name}/SKILL.md`)
      return [name, result.ok]
    })).then(entries => { if (!cancelled) setSkills(Object.fromEntries(entries)) }).catch(() => {})
    return () => { cancelled = true }
  }, [status, agent.provider, agent.projectPath])
  const [imageBrief, setImageBrief] = useState('')
  const [showImagePrompt, setShowImagePrompt] = useState(false)

  // TICKET-0150: optional first-prompt questionnaire, triggered by the
  // SessionStart Claude Code hook (see HookService.js) on a fresh session or
  // a `/clear`. Queued in state rather than shown the instant it arrives --
  // a fresh launch can fire it while the launch banner is still up -- and
  // rendered once the banner has lifted, below.
  const [questionnaireSource, setQuestionnaireSource] = useState(null)
  const [questionnaireFields, setQuestionnaireFields] = useState({
    topic: '', description: '', avoidInclude: '', doneLooksLike: '',
  })

  // TICKET-0052: chunked paste for large clipboard content. Pastes over
  // this threshold get split into chunks with small delays between them to
  // avoid overwhelming the PTY buffer.
  const LARGE_PASTE_THRESHOLD = 8192 // 8KB
  const PASTE_CHUNK_SIZE = 4096 // 4KB chunks
  const PASTE_CHUNK_DELAY_MS = 50 // 50ms between chunks

  // Paste text to the terminal, chunking if needed for large pastes
  async function pasteToTerminal(text) {
    if (!sessionIdRef.current || !text) return

    if (text.length <= LARGE_PASTE_THRESHOLD) {
      // Small paste - write immediately
      window.ace.terminal.write(sessionIdRef.current, text)
      return
    }

    // Large paste - chunk it with feedback
    setPasteStatus({ type: 'loading' })
    try {
      for (let i = 0; i < text.length; i += PASTE_CHUNK_SIZE) {
        const chunk = text.slice(i, i + PASTE_CHUNK_SIZE)
        window.ace.terminal.write(sessionIdRef.current, chunk)
        // Brief delay between chunks to let PTY buffer drain
        if (i + PASTE_CHUNK_SIZE < text.length) {
          await new Promise(resolve => setTimeout(resolve, PASTE_CHUNK_DELAY_MS))
        }
      }
      setPasteStatus({ type: 'success', message: `Pasted ${(text.length / 1024).toFixed(1)}KB` })
      setTimeout(() => setPasteStatus(null), 3000)
    } catch (err) {
      setPasteStatus({ type: 'error', message: `Paste failed: ${err.message}` })
      setTimeout(() => setPasteStatus(null), 6000)
    }
  }


  useEffect(() => {
    let disposed = false
    let unsubData
    let unsubExit
    let unsubHostRestarted
    let unsubQuestionnaire
    let hideBannerTimer
    let handleContextMenu
    let handlePaste

    // TICKET-0150: settings:get returns null until the user ever touches the
    // toggle, and stores booleans as the string '1'/'0' (sql.js has no real
    // boolean column type) -- default is enabled, so only a stored '0' turns
    // it off.
    if (agent.provider === 'claude') {
      window.ace.getSetting('first_prompt_questionnaire_enabled').then((enabled) => {
        if (disposed || enabled === '0') return
        unsubQuestionnaire = window.ace.onQuestionnaireRequest(({ agentId, source }) => {
          if (agentId === agent.agentId) setQuestionnaireSource(source)
        })
      }).catch(() => {})
    }

    // Used when the session errors or exits before the timed reveal fires --
    // don't leave the error/exit message hidden behind the overlay.
    function revealImmediately() {
      clearTimeout(hideBannerTimer)
      setShowBanner(false)
    }

    const linkHandler = {
      allowNonHttpProtocols: true,
      activate: (event, target) => {
        openTerminalLink(event, target, window.ace.shell, agent.projectPath)
          .catch(error => window.alert(`Failed to open link: ${error.message}`))
      },
      hover: showLinkTooltip,
      leave: hideLinkTooltip,
    }

    const term = new Terminal({
      convertEol: true,
      fontSize: 13,
      fontFamily: "Consolas, 'Cascadia Mono', 'Courier New', monospace",
      theme: XTERM_THEME,
      cursorBlink: true,
      scrollback: 5000,
      altClickMovesCursor: false,
      linkHandler,
    })
    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)

    // Web links addon for URL detection
    const webLinksAddon = new WebLinksAddon(linkHandler.activate, linkHandler)
    term.loadAddon(webLinksAddon)

    // Custom link provider for file paths
    term.registerLinkProvider({
      provideLinks(bufferLineNumber, callback) {
        const line = term.buffer.active.getLine(bufferLineNumber - 1)
        if (!line) return callback(undefined)

        const lineText = line.translateToString(true)
        const links = []

        for (const { path, label, index } of findFileLinks(lineText)) {
          links.push({
            range: {
              start: { x: index + 1, y: bufferLineNumber },
              end: { x: index + label.length, y: bufferLineNumber },
            },
            text: path,
            activate: (event) => linkHandler.activate(event, path),
            hover: showLinkTooltip,
            leave: hideLinkTooltip,
          })
        }

        callback(links.length > 0 ? links : undefined)
      }
    })

    term.open(containerRef.current)
    fitAddon.fit()
    // Store terminal instance for focus restoration
    terminalRef.current = term
    // Ensure terminal has focus for keyboard input
    term.focus()

    async function start() {
      const { cols, rows } = term
      let pendingOutput = []
      let lastSequence = 0
      const acceptOutput = ({ id, chunk, sequence }) => {
        if (id !== sessionIdRef.current || sequence <= lastSequence) return
        term.write(chunk)
        lastSequence = sequence
      }
      unsubData = window.ace.terminal.onData(message => {
        if (message.agentId && message.agentId !== agent.agentId) return
        if (pendingOutput) pendingOutput.push(message)
        else acceptOutput(message)
      })
      // Auto-answer starts off for every new session -- see the state
      // comment above. Use the 🛡️ Auto-approve pill to turn it on.
      const result = await window.ace.terminal.spawn({
        agentId: agent.agentId,
        cols,
        rows,
        cwd: agent.projectPath,
      })
      if (disposed) return
      if (!result.success) {
        unsubData()
        updateStatus('error')
        term.write(`\r\n\x1b[31mFailed to start terminal: ${result.error || 'unknown error'}\x1b[0m\r\n`)
        revealImmediately()
        return
      }
      sessionIdRef.current = result.id
      term.write(result.output || '')
      lastSequence = result.sequence || 0
      pendingOutput.forEach(acceptOutput)
      pendingOutput = null
      setAutoAnswer(!!result.autoAnswer)
      updateStatus('ready')

      unsubExit = window.ace.terminal.onExit(({ id, exitCode }) => {
        if (id !== sessionIdRef.current) return
          updateStatus(exitCode === 0 ? 'exited' : 'error')
        term.write(`\r\n\x1b[90m[process exited with code ${exitCode}]\x1b[0m\r\n`)
        revealImmediately()
      })
      unsubHostRestarted = window.ace.terminal.onHostRestarted(() => {
        updateStatus('exited')
        term.write('\r\n\x1b[31m[terminal process was lost -- stop and relaunch this agent to start a new session]\x1b[0m\r\n')
        revealImmediately()
      })

      term.onData((data) => {
        if (sessionIdRef.current) window.ace.terminal.write(sessionIdRef.current, data)
        if (!titleCapturedRef.current) {
          const { buffer, line } = feedLineCapture(titleBufferRef.current, data)
          titleBufferRef.current = buffer
          if (line) {
            titleCapturedRef.current = true
            // Show the local heuristic title immediately (instant, never
            // fails) then try to upgrade it to a short AI-generated title
            // that captures what's actually being solved, once that headless
            // call resolves a moment later. Any failure there (CLI missing,
            // timeout, empty reply) just leaves the fallback title in place.
            const fallbackTitle = deriveTitle(line)
            useStore.getState().updateAgentSessionTitle(agent.agentId, fallbackTitle)
            window.ace.updateAgentSessionTitle(agent.agentId, fallbackTitle)
            window.ace.generateTitle(line, agent.projectPath, agent.provider).then(({ title } = {}) => {
              if (!title || title === fallbackTitle) return
              useStore.getState().updateAgentSessionTitle(agent.agentId, title)
              window.ace.updateAgentSessionTitle(agent.agentId, title)
            }).catch(() => {})
          }
        }
      })

      // Enable clipboard support - Cmd/Ctrl+C to copy, Cmd/Ctrl+V to paste
      term.attachCustomKeyEventHandler((event) => {
        // Copy the selection. TICKET-0102: the modifier is platform-selected,
        // not OR-ed -- on macOS copy is Cmd+C and Ctrl+C must still reach the
        // CLI as SIGINT, so accepting either would break interrupt there.
        // Keydown only, so one keypress doesn't write the clipboard twice.
        const copyModifier = IS_MAC ? event.metaKey : event.ctrlKey
        if (event.type === 'keydown' && copyModifier && event.key.toLowerCase() === 'c' && term.hasSelection()) {
          navigator.clipboard.writeText(term.getSelection())
          return false // Prevent default
        }
        // Ctrl/Cmd+V stays on the browser's normal paste-event path. The
        // capture-phase handler below owns that event before xterm's textarea
        // can also turn it into onData, guaranteeing one PTY write path.
        // Returning false suppresses xterm's key processing without cancelling
        // the browser's native paste event.
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'v' && event.type === 'keydown') {
          return false
        }
        return true // Allow all other keys
      })

      // Right-click paste support (TICKET-0052: chunked for large pastes).
      // stopPropagation keeps the app-wide Copy/Paste context menu
      // (TICKET-0051, wired in App.jsx) from also firing over the terminal --
      // the terminal owns its own copy (Ctrl+C on a selection) and paste
      // (right-click / Ctrl+V) behaviour. Also handles images.
      handleContextMenu = async (e) => {
        e.preventDefault()
        e.stopPropagation()

        // Clipboard permission failures may fall back to text; image save failures must stay visible.
        let items = []
        try { items = await navigator.clipboard.read() } catch (_) { /* text fallback below */ }
        for (const item of items) {
          const type = item.types.find(type => type.startsWith('image/'))
          if (!type) continue
          try {
            await pasteImage(await item.getType(type), window.ace.clipboard, agent.projectPath, term)
            setPasteStatus(null)
          } catch (error) {
            setPasteStatus({ type: 'error', message: `Image paste failed: ${error.message}` })
          }
          return
        }

        // No image, paste text
        navigator.clipboard.readText().then(pasteToTerminal).catch(err => {
          console.error('Paste failed:', err)
          term.write('\r\n\x1b[31mPaste failed\x1b[0m\r\n')
        })
      }
      containerRef.current.addEventListener('contextmenu', handleContextMenu)

      // xterm registers paste listeners on both its textarea and terminal
      // element. A bubble listener on our parent runs too late because the
      // textarea target handler has already emitted onData. Capture the event
      // first, stop it before xterm sees it, and route its payload through the
      // single chunk-aware PTY writer. Also handles pasted images.
      handlePaste = async (e) => {
        e.preventDefault()
        e.stopImmediatePropagation()

        const imageItem = Array.from(e.clipboardData?.items || []).find(item => item.type.startsWith('image/'))
        if (imageItem) {
          try {
            await pasteImage(imageItem.getAsFile(), window.ace.clipboard, agent.projectPath, term)
            setPasteStatus(null)
          } catch (error) {
            setPasteStatus({ type: 'error', message: `Image paste failed: ${error.message}` })
          }
          return
        }

        // No image, handle text paste
        readPasteText(e, navigator.clipboard).then(pasteToTerminal).catch(err => {
          console.error('Paste failed:', err)
          term.write('\r\n\x1b[31mPaste failed\x1b[0m\r\n')
        })
      }
      containerRef.current.addEventListener('paste', handlePaste, true)

      // TICKET-0044: force a known CLI session id for Claude agents so their
      // tokscale usage can be attributed to this agent's name and session title
      // in the Token Usage "By Agent" and "By Session" breakdowns. Codex has no
      // equivalent flag, so it keeps its own auto-generated session and stays
      // "Untracked" there.
      if (result.reconnected) {
        setShowBanner(false)
        return
      }

      // See LAUNCH_BANNER_HIDE_MS above -- lift the overlay once the CLI has
      // had time to render its Welcome box. No term.clear() here: that wiped
      // the box itself on macOS (TICKET-0102).
      hideBannerTimer = setTimeout(() => {
        if (disposed) return
        setShowBanner(false)
        // Projects made through `✨ New` carry a one-shot `.claude/.needs-setup`
        // marker. The first Claude agent to reach this point consumes it and
        // auto-starts the guided setup interview.
        // ponytail: reuses the banner delay as the "CLI is ready" signal
        // instead of matching the prompt string -- upgrade to a content match
        // if a cold start ever races the keystroke.
        if (agent.provider !== 'codex' && sessionIdRef.current) {
          window.ace.consumeProjectSetupFlag(agent.projectPath)
            .then((res) => {
              if (res?.needsSetup && !disposed && sessionIdRef.current) {
                window.ace.terminal.write(sessionIdRef.current, '/project-setup\r')
              }
            })
            .catch(() => {})
        }
      }, LAUNCH_BANNER_HIDE_MS)
    }
    start().catch(error => {
      unsubData?.()
      if (!disposed) {
        updateStatus('error')
        term.write(`\r\nFailed to start terminal: ${error.message}\r\n`)
        revealImmediately()
      }
    })

    const resizeObserver = new ResizeObserver(() => {
      try {
        fitAddon.fit()
        const { cols, rows } = term
        if (sessionIdRef.current) window.ace.terminal.resize(sessionIdRef.current, cols, rows)
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
      unsubQuestionnaire?.()
      if (handleContextMenu) containerRef.current?.removeEventListener('contextmenu', handleContextMenu)
      if (handlePaste) containerRef.current?.removeEventListener('paste', handlePaste, true)
      hideLinkTooltip()
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
    window.ace.terminal.setAutoAnswer(sessionIdRef.current, next)
  }

  // TICKET-0150: Send composes the four fields and submits them as the first
  // prompt; Skip just dismisses. Uses the same bracketed-paste path as
  // NotesPanel (multi-line safe -- a raw PTY write would submit early on
  // every embedded newline), then a separate real Enter to actually submit.
  function submitQuestionnaire() {
    const prompt = buildFirstPrompt(questionnaireFields)
    if (prompt && sessionIdRef.current && terminalRef.current?.modes.bracketedPasteMode) {
      terminalRef.current.paste(prompt)
      window.ace.terminal.write(sessionIdRef.current, '\r')
    }
    dismissQuestionnaire()
  }
  function dismissQuestionnaire() {
    setQuestionnaireSource(null)
    setQuestionnaireFields({ topic: '', description: '', avoidInclude: '', doneLooksLike: '' })
    terminalRef.current?.focus()
  }

  // Image generation is provided by the signed-in Codex CLI session. This
  // does not swap the selected coding model or send an API key through ACE.
  function requestImageGeneration() {
    const prompt = buildImageGenerationPrompt(imageBrief)
    if (!prompt || !sessionIdRef.current) return
    window.ace.terminal.write(sessionIdRef.current, `${prompt}\r`)
    setShowImagePrompt(false)
    setImageBrief('')
    terminalRef.current?.focus()
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
          <details className="relative">
            <summary className="cursor-pointer text-sm px-2 py-1 rounded border border-border">Actions</summary>
            <div className="absolute left-0 top-full z-20 bg-panel border border-border rounded p-2 flex flex-col gap-2 min-w-48">
          <button
            onClick={() => {
              if (sessionIdRef.current) {
                if (skills['push-update']) window.ace.terminal.write(sessionIdRef.current, '/push-update\r')
              }
            }}
            disabled={!skills['push-update']}
            title={skills['push-update'] ? 'Prompt Claude to run /push-update' : 'Unavailable: requires the Claude project skill'}
            className="text-xs py-0.5 px-2 rounded border border-border text-muted hover:bg-border transition-colors">
            ⬆️ Push update
          </button>
          <button
            onClick={() => {
              if (sessionIdRef.current) {
                if (skills['calibrate-enhanced']) window.ace.terminal.write(sessionIdRef.current, '/calibrate-enhanced\r')
              }
            }}
            disabled={!skills['calibrate-enhanced']}
            title={skills['calibrate-enhanced'] ? 'Prompt Claude to run /calibrate-enhanced' : 'Unavailable: requires the Claude project skill'}
            className="text-xs py-0.5 px-2 rounded border border-border text-muted hover:bg-border transition-colors">
            🎯 Calibrate
          </button>
          {agent.provider === 'codex' && (
            <button
              onClick={() => setShowImagePrompt(true)}
              title="Ask this signed-in Codex session to generate an image and save it under .ace/generated-images"
              className="text-xs py-0.5 px-2 rounded border border-border text-muted hover:bg-border transition-colors">
              Generate image
            </button>
          )}
          <button
            onClick={() => {
              if (sessionIdRef.current) {
                if (agent.provider === 'claude') window.ace.terminal.write(sessionIdRef.current, '/clear\r')
              }
            }}
            disabled={agent.provider !== 'claude'}
            title={agent.provider === 'claude' ? 'Clear the conversation context' : 'Use the Codex CLI menu to start a new conversation'}
            className="text-xs py-0.5 px-2 rounded border border-border text-muted hover:bg-border transition-colors">
            🧹 Clear
          </button>
            </div>
          </details>
          <button
            onClick={() => setShowNotes(true)}
            title="Shared project notes -- write reminders/summaries here, or send one into this terminal's chat"
            className="text-xs py-0.5 px-2 rounded border border-border text-muted hover:bg-border transition-colors">
            📝 Notes
          </button>
        </div>
      )}
      <NotesPanel
        isOpen={showNotes}
        onClose={() => setShowNotes(false)}
        projectPath={agent.projectPath}
        onSend={(text) => {
          if (!sessionIdRef.current || !terminalRef.current?.modes.bracketedPasteMode) {
            throw new Error('This terminal is not accepting safe pasted input yet. Wait for the provider prompt and retry.')
          }
          terminalRef.current.paste(text)
        }}
      />
      {showImagePrompt && <Modal title="Generate image" onClose={() => setShowImagePrompt(false)}>
        <label className="text-sm">Image brief<textarea autoFocus className="input h-32" value={imageBrief} onChange={e => setImageBrief(e.target.value)} /></label>
        <div className="flex justify-end gap-2 mt-3">
          <button className="btn-ghost" onClick={() => setShowImagePrompt(false)}>Cancel</button>
          <button className="btn-primary" disabled={!imageBrief.trim()} onClick={requestImageGeneration}>Generate</button>
        </div>
      </Modal>}
      {questionnaireSource && !showBanner && (
        <Modal title="What are we working on?" wide onClose={dismissQuestionnaire}>
          <p className="text-xs text-muted -mt-2 mb-3">
            Optional -- helps shape the first prompt. Fill in as much or as little as you like, or skip it.
          </p>
          <div className="space-y-3">
            <label className="text-sm block">One-line summary
              <input autoFocus className="input" placeholder="e.g. Add dark mode to Settings"
                value={questionnaireFields.topic}
                onChange={e => setQuestionnaireFields(f => ({ ...f, topic: e.target.value }))} />
            </label>
            <label className="text-sm block">General description
              <textarea className="input h-20" placeholder="What is this, and why does it matter?"
                value={questionnaireFields.description}
                onChange={e => setQuestionnaireFields(f => ({ ...f, description: e.target.value }))} />
            </label>
            <label className="text-sm block">Things to avoid or include
              <textarea className="input h-20" placeholder="Constraints, files to leave alone, must-haves..."
                value={questionnaireFields.avoidInclude}
                onChange={e => setQuestionnaireFields(f => ({ ...f, avoidInclude: e.target.value }))} />
            </label>
            <label className="text-sm block">What does "done" look like?
              <textarea className="input h-20" placeholder="How will we know this is finished?"
                value={questionnaireFields.doneLooksLike}
                onChange={e => setQuestionnaireFields(f => ({ ...f, doneLooksLike: e.target.value }))} />
            </label>
          </div>
          <div className="flex justify-end gap-2 mt-3">
            <button className="btn-ghost" onClick={dismissQuestionnaire}>Skip</button>
            <button className="btn-primary" onClick={submitQuestionnaire}>Send</button>
          </div>
        </Modal>
      )}
      {/* TICKET-0050: progress + success/fail feedback for the direct git/build actions */}
      {/* TICKET-0052: feedback for large paste operations */}
      <OperationFeedback label="Pasting" status={pasteStatus} />
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
          <div>Launching {agent.agentName}…</div>
        </div>
      )}
    </div>
  )
}
