// Builds the command line typed into a freshly-spawned per-agent terminal
// (see AgentTerminal.jsx) so each agent card boots straight into the real
// interactive `claude`/`codex` CLI instead of an empty shell.
//
// buildPermissionArgs mirrors AgentService.js's function of the same name
// (main process) -- the same CLI flags apply whether Claude is invoked
// headlessly (--print) or interactively, but main and renderer are separate
// module systems here so this is a deliberate, small, kept-in-sync-by-hand
// duplicate rather than a shared import.
function buildPermissionArgs(permissionMode) {
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

function quoteArg(arg) {
  return /^[A-Za-z0-9_.-]+$/.test(arg) ? arg : `"${arg.replace(/"/g, '\\"')}"`
}

export function buildLaunchCommand({ provider, model, permissionMode }) {
  const args = provider === 'codex'
    ? ['openai', 'codex', '--model', model]
    : ['claude', '--model', model, ...buildPermissionArgs(permissionMode)]
  return args.map(quoteArg).join(' ')
}
