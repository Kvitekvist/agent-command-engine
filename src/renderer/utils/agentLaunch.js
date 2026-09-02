// Builds the command line typed into a freshly-spawned per-agent terminal
// (see AgentTerminal.jsx) so each agent card boots straight into the real
// interactive `claude`/`codex` CLI instead of an empty shell.
//
// buildClaudePermissionArgs mirrors AgentService.js's buildPermissionArgs
// (main process) -- the same CLI flags apply whether Claude is invoked
// headlessly (--print) or interactively, but main and renderer are separate
// module systems here so this is a deliberate, small, kept-in-sync-by-hand
// duplicate rather than a shared import.
function buildClaudePermissionArgs(permissionMode) {
  if (permissionMode === 'auto') {
    return ['--dangerously-skip-permissions']
  }
  if (permissionMode === 'ask') {
    return [
      '--allowedTools', 'Read', 'Edit', 'Write', 'Glob', 'Grep', 'Bash', 'PowerShell',
      '--disallowedTools', 'Bash(rm:*)', 'Bash(sudo:*)', 'PowerShell(Remove-Item:*)',
    ]
  }
  return ['--allowedTools', 'Read', 'Edit', 'Write', 'Glob', 'Grep']
}

// TICKET-0020: the real Codex CLI is the `codex` binary (npm package
// `codex-cli`) -- NOT `openai` (that's the unrelated openai-python SDK's
// CLI, which has no `codex` subcommand at all). Sandbox/approval flag
// names and values confirmed via `codex --help`, mapped to the same
// three-tier safe/guarded/auto policy Claude gets from
// buildClaudePermissionArgs above.
function buildCodexArgs(permissionMode) {
  if (permissionMode === 'auto') {
    return ['--dangerously-bypass-approvals-and-sandbox']
  }
  if (permissionMode === 'ask') {
    return ['--sandbox', 'workspace-write', '--ask-for-approval', 'on-request']
  }
  // Current Codex releases accept only `on-request` and `never` here.
  // Safe mode is already constrained by the read-only sandbox, so it must
  // never request an escalation outside that sandbox.
  return ['--sandbox', 'read-only', '--ask-for-approval', 'never']
}

function quoteArg(arg) {
  return /^[A-Za-z0-9_.-]+$/.test(arg) ? arg : `"${arg.replace(/"/g, '\\"')}"`
}

// TICKET-0044: `sessionId`, when given, is injected as `claude --session-id
// <uuid>` so ACE knows exactly which CLI session belongs to this agent and can
// attribute its tokscale usage to the agent's name in the "By Agent" breakdown.
// Behaviour-neutral: each terminal mount already started a brand-new session
// (no --resume), so forcing a fresh UUID per launch changes nothing the user
// sees. Codex has no equivalent flag (and isn't reconciled), so it's skipped.
// `settingsPath`, when given, is injected as `claude --settings <path>` -- it
// points at the ACE-generated JSON that wires Claude's lifecycle hooks to the
// per-agent status badge (see HookService.js). Additive to the project's own
// Claude settings; Codex has no equivalent, so it's skipped there.
export function buildLaunchCommand({ provider, model, permissionMode }, sessionId, settingsPath) {
  const args = provider === 'codex'
    ? ['codex', '--model', model, ...buildCodexArgs(permissionMode)]
    : [
        'claude', '--model', model,
        ...(sessionId ? ['--session-id', sessionId] : []),
        ...(settingsPath ? ['--settings', settingsPath] : []),
        ...buildClaudePermissionArgs(permissionMode),
      ]
  return args.map(quoteArg).join(' ')
}
