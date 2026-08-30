import React, { useEffect, useState } from 'react'
import OperationFeedback from './OperationFeedback'
import { runOperation } from '../utils/runOperation'

// TICKET-0055: the actual status rows + install buttons, reused both
// full-screen (SetupView.jsx, shown when claude/codex is missing) and inline
// (SettingsView.jsx's "Prerequisites" section, for re-running anytime).
const CLI_INFO = {
  claude: { label: 'Claude Code CLI', pkg: '@anthropic-ai/claude-code' },
  codex: { label: 'Codex CLI', pkg: '@openai/codex' },
}

export default function PrereqChecklist() {
  const [checking, setChecking] = useState(true)
  const [status, setStatus] = useState(null) // { node, npm, claude, codex } -> { present, version }
  const [installStatus, setInstallStatus] = useState({ claude: null, codex: null })

  async function check() {
    setChecking(true)
    const result = await window.ace.prereqs.check()
    setStatus(result)
    setChecking(false)
  }

  useEffect(() => { check() }, [])

  async function install(name) {
    const setNameStatus = (val) => setInstallStatus((s) => ({ ...s, [name]: val }))
    await runOperation(installStatus[name], setNameStatus, CLI_INFO[name].label, () => window.ace.prereqs.install(name))
    check()
  }

  if (checking && !status) {
    return <div className="text-xs text-muted">Checking prerequisites…</div>
  }

  const nodeReady = !!(status?.node?.present && status?.npm?.present)
  const gitReady = !!status?.git?.present

  return (
    <div>
      <div className="flex items-center justify-between gap-3 py-2 border-b border-border">
        <div>
          <div className="text-sm text-gray-200">Node.js + npm</div>
          <div className="text-xs text-muted">
            {nodeReady
              ? `Node v${status.node.version}, npm v${status.npm.version}`
              : 'Not found — required to install the Claude/Codex CLIs'}
          </div>
        </div>
        <div className="shrink-0">
          {nodeReady ? (
            <span className="badge-green">✓ Installed</span>
          ) : (
            <button className="btn-ghost text-xs" onClick={() => window.ace.prereqs.openNodeDownload()}>
              Download Node.js ↗
            </button>
          )}
        </div>
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
    </div>
  )
}
