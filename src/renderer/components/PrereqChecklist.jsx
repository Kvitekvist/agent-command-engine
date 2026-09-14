import React, { useEffect, useRef, useState } from 'react'
import OperationFeedback from './OperationFeedback'
import { runOperation } from '../utils/runOperation'

// TICKET-0055: the actual status rows + install buttons, reused both
// full-screen (SetupView.jsx, shown when claude/codex is missing) and inline
// (SettingsView.jsx's "Prerequisites" section, for re-running anytime).
const CLI_INFO = {
  claude: { label: 'Claude Code CLI', pkg: '@anthropic-ai/claude-code' },
  codex: { label: 'Codex CLI', pkg: '@openai/codex' },
}

export default function PrereqChecklist({ allowUninstall = false, autoInstall = false }) {
  const [checking, setChecking] = useState(true)
  const [checkError, setCheckError] = useState('')
  const [status, setStatus] = useState(null) // { node, npm, claude, codex } -> { present, version }
  const [installStatus, setInstallStatus] = useState({ claude: null, codex: null })
  const [nodeStatus, setNodeStatus] = useState(null)
  const [uninstallStatus, setUninstallStatus] = useState(null)
  const isWindows = window.ace?.platform === 'win32'
  const attemptedRef = useRef(new Set())

  async function check() {
    setChecking(true)
    try {
      const result = await window.ace.prereqs.check()
      setStatus(result)
      setCheckError('')
    } catch (error) { setCheckError(error.message) }
    finally { setChecking(false) }
  }

  useEffect(() => { check() }, [])

  async function install(name) {
    const setNameStatus = (val) => setInstallStatus((s) => ({ ...s, [name]: val }))
    await runOperation(installStatus[name], setNameStatus, CLI_INFO[name].label, () => window.ace.prereqs.install(name))
    check()
  }

  async function installNode() {
    const result = await runOperation(nodeStatus, setNodeStatus, 'Node.js', () => window.ace.prereqs.installNode())
    // This process's PATH can't pick up the new npm without a restart. Only
    // SetupView (autoInstall) relaunches for you -- Settings' inline re-run
    // may have agent terminals open, so it keeps the manual "restart ACE" copy.
    if (result?.ok && autoInstall) { window.ace.prereqs.relaunch(); return }
    check()
  }

  async function uninstallProvider(name) {
    await runOperation(uninstallStatus, setUninstallStatus, name, () => window.ace.prereqs.uninstall(name))
    check()
  }

  // SetupView opts in via autoInstall: run each missing piece once, node
  // first (CLIs need npm), instead of waiting for a click. Settings' inline
  // checklist leaves autoInstall off so re-checking there never launches an
  // install on its own. attemptedRef stops a failed install (e.g. EACCES)
  // from retrying every time `status` refreshes.
  useEffect(() => {
    if (!autoInstall || !status) return
    const ready = !!(status.node?.present && status.npm?.present)
    if (isWindows && !ready) {
      if (nodeStatus?.type !== 'loading' && !attemptedRef.current.has('node')) {
        attemptedRef.current.add('node')
        installNode()
      }
      return
    }
    if (!ready) return
    for (const name of ['claude', 'codex']) {
      if (!status[name]?.present && installStatus[name]?.type !== 'loading' && !attemptedRef.current.has(name)) {
        attemptedRef.current.add(name)
        install(name)
      }
    }
  }, [autoInstall, status])

  if (checking && !status) {
    return <div className="text-xs text-muted">Checking prerequisites…</div>
  }

  const nodeReady = !!(status?.node?.present && status?.npm?.present)
  const gitReady = !!status?.git?.present

  return (
    <div>
      {checkError && <p role="alert" className="text-danger">{checkError}. Last results may be stale. <button onClick={check}>Retry</button></p>}
      <div className="py-2 border-b border-border">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm text-gray-200">Node.js + npm</div>
            <div className="text-xs text-muted">
              {nodeReady
                ? `Node v${status.node.version}, npm v${status.npm.version}`
                : 'Not found — required to install the Claude/Codex CLIs'}
            </div>
          </div>
          <div className="shrink-0 flex items-center gap-2">
            {nodeReady ? (
              <span className="badge-green">✓ Installed</span>
            ) : isWindows ? (
              <>
                <button
                  className="btn-primary text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={nodeStatus?.type === 'loading'}
                  onClick={installNode}
                >
                  {nodeStatus?.type === 'loading' ? 'Installing…' : 'Install Node.js'}
                </button>
                <button className="btn-ghost text-xs" onClick={() => window.ace.prereqs.openNodeDownload()}>
                  Download ↗
                </button>
              </>
            ) : (
              <button className="btn-ghost text-xs" onClick={() => window.ace.prereqs.openNodeDownload()}>
                Download Node.js ↗
              </button>
            )}
          </div>
        </div>
        {!nodeReady && isWindows && <OperationFeedback label="Node.js" status={nodeStatus} />}
      </div>

      <div className="flex items-center justify-between gap-3 py-2 border-b border-border">
        <div>
          <div className="text-sm text-gray-200">Git</div>
          <div className="text-xs text-muted">
            {gitReady
              ? status.git.version
              : 'Not found — used for project git-init and the ticket → branch → PR workflow'}
          </div>
        </div>
        <div className="shrink-0">
          {gitReady ? (
            <span className="badge-green">✓ Installed</span>
          ) : (
            <button className="btn-ghost text-xs" onClick={() => window.ace.prereqs.openGitDownload()}>
              Download Git ↗
            </button>
          )}
        </div>
      </div>

      {['claude', 'codex'].map((name) => {
        const info = status?.[name]
        const inst = installStatus[name]
        const { label, pkg } = CLI_INFO[name]
        return (
          <div key={name} className="py-2 border-b border-border last:border-b-0">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm text-gray-200">{label}</div>
                <div className="text-xs text-muted">
                  {/* claude/codex --version print their own label + version text (e.g.
                      "codex-cli 0.147.0"), unlike node/npm's plain semver -- shown as-is,
                      not prefixed with an extra "v" that would read like "vcodex-cli …". */}
                  {info?.present ? info.version : `Not found (npm package ${pkg})`}
                </div>
              </div>
              <div className="shrink-0">
                {info?.present ? (
                  <span className="badge-green">✓ Installed</span>
                ) : (
                  <button
                    className="btn-primary text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={!nodeReady || inst?.type === 'loading'}
                    onClick={() => install(name)}
                    title={!nodeReady ? 'Install Node.js (with npm) first' : undefined}
                  >
                    {inst?.type === 'loading' ? 'Installing…' : `Install ${label}`}
                  </button>
                )}
              </div>
            </div>
            <OperationFeedback label={label} status={inst} />
          </div>
        )
      })}

      <div className="flex items-center justify-between pt-3">
        <button className="btn-ghost text-xs" onClick={check} disabled={checking}>
          {checking ? 'Checking…' : '↻ Recheck'}
        </button>
        {status?.claude?.present && status?.codex?.present && (
          <span className="text-xs text-success">✓ Ready to launch agents</span>
        )}
      </div>

      {allowUninstall && (
        <div className="pt-3 mt-2 border-t border-border">
          <details>
            <summary className="text-sm cursor-pointer">Advanced / Maintenance</summary>
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs text-muted">
              Uninstall the Claude/Codex CLIs (npm global) to test a clean setup.
              Node.js, npm and Git are left alone.
            </div>
            {['claude', 'codex'].map(name => <button key={name}
              className="btn-ghost text-xs shrink-0"
              onClick={() => uninstallProvider(name)}
              disabled={uninstallStatus?.type === 'loading'}
            >
              {uninstallStatus?.type === 'loading' ? 'Removing...' : `Remove ${name} globally`}
            </button>)}
          </div>
          </details>
          <OperationFeedback label="CLIs" status={uninstallStatus} />
        </div>
      )}
    </div>
  )
}
