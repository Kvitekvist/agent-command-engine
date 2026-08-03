const assert = require('node:assert/strict')
const test = require('node:test')

const {
  buildPermissionArgs,
  computeTokscaleDelta,
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

test('tokscale reconciliation diffs cumulative session usage into a turn delta', () => {
  const baseline = { inputTokens: 100, outputTokens: 50, cacheReadTokens: 1000, cacheCreationTokens: 200, costUsd: 0.5 }
  const usage = { inputTokens: 140, outputTokens: 90, cacheReadTokens: 1800, cacheCreationTokens: 260, costUsd: 0.9 }

  assert.deepEqual(computeTokscaleDelta(usage, baseline), {
    input: 40, output: 40, cacheRead: 800, cacheCreation: 60, cost: 0.4,
  })
})

test('tokscale reconciliation clamps a backwards-moving reading to zero instead of a negative delta', () => {
  const baseline = { inputTokens: 500, outputTokens: 300, cacheReadTokens: 9000, cacheCreationTokens: 400, costUsd: 2 }
  const usage = { inputTokens: 500, outputTokens: 300, cacheReadTokens: 8000, cacheCreationTokens: 400, costUsd: 1.5 }

  assert.deepEqual(computeTokscaleDelta(usage, baseline), {
    input: 0, output: 0, cacheRead: 0, cacheCreation: 0, cost: 0,
  })
})
