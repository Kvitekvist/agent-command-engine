const assert = require('node:assert/strict')
const test = require('node:test')

const {
  buildPermissionArgs,
  parsePermissionDenials,
  parseSessionId,
  parseText,
  parseTokens,
  parseToolUse,
} = require('../main/services/AgentService')

test('parses the final Claude result', () => {
  const line = JSON.stringify({
    type: 'result',
    session_id: 'session-1',
    result: 'Finished',
    usage: { input_tokens: 12, output_tokens: 7 },
  })

  assert.deepEqual(parseTokens(line), { input: 12, output: 7 })
  assert.equal(parseSessionId(line), 'session-1')
  assert.equal(parseText(line), 'Finished')
})

test('ignores malformed stream lines', () => {
  assert.equal(parseTokens('{'), null)
  assert.equal(parseSessionId('{'), null)
  assert.equal(parseText('{'), null)
  assert.equal(parseToolUse('{'), null)
  assert.equal(parsePermissionDenials('{'), null)
})

test('extracts tool use and permission denials', () => {
  const toolLine = JSON.stringify({
    type: 'assistant',
    message: { content: [{ type: 'tool_use', name: 'Read', input: { file_path: 'README.md' } }] },
  })
  const denialLine = JSON.stringify({
    type: 'result',
    permission_denials: [{ tool_name: 'Bash', tool_input: { command: 'rm file' } }],
  })

  assert.deepEqual(parseToolUse(toolLine), {
    tool: 'Read',
    input: { file_path: 'README.md' },
  })
  assert.equal(parsePermissionDenials(denialLine)[0].tool_name, 'Bash')
})

test('permission modes are conservative by default', () => {
  assert.deepEqual(buildPermissionArgs('unknown'), [
    '--allowedTools', 'Read', 'Edit', 'Write', 'Glob', 'Grep',
  ])
  assert.deepEqual(buildPermissionArgs('auto'), ['--dangerously-skip-permissions'])
  assert.ok(buildPermissionArgs('ask').includes('Bash'))
})
