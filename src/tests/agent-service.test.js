const assert = require('node:assert/strict')
const test = require('node:test')

const {
  buildPermissionArgs,
  buildCodexArgs,
  buildTitleCommand,
} = require('../main/services/AgentService')

test('title generation uses the economical model for each provider', () => {
  assert.deepEqual(buildTitleCommand('claude'), {
    command: 'claude',
    args: [
      '--print', '--output-format', 'text', '--model', 'claude-haiku-4-5-20251001',
      '--allowedTools', 'Read', 'Edit', 'Write', 'Glob', 'Grep',
    ],
  })
  assert.deepEqual(buildTitleCommand('codex'), {
    command: 'codex',
    args: [
      'exec', '--model', 'gpt-5.6-luna',
      '--sandbox', 'read-only', '--ask-for-approval', 'never',
    ],
  })
})

test('permission modes are conservative by default', () => {
  assert.deepEqual(buildPermissionArgs('unknown'), [
    '--allowedTools', 'Read', 'Edit', 'Write', 'Glob', 'Grep',
  ])
  assert.deepEqual(buildPermissionArgs('auto'), ['--dangerously-skip-permissions'])
  assert.ok(buildPermissionArgs('ask').includes('Bash'))
})

test('codex permission modes map to real --sandbox/--ask-for-approval flags (TICKET-0020)', () => {
  assert.deepEqual(buildCodexArgs('unknown'), [
    '--sandbox', 'read-only', '--ask-for-approval', 'never',
  ])
  assert.deepEqual(buildCodexArgs('ask'), [
    '--sandbox', 'workspace-write', '--ask-for-approval', 'on-request',
  ])
  assert.deepEqual(buildCodexArgs('auto'), ['--dangerously-bypass-approvals-and-sandbox'])
})
