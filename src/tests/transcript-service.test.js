const test = require('node:test')
const assert = require('node:assert')
const { parseTranscript, parseCodex } = require('../main/services/TranscriptService')

test('parseTranscript keeps text, tool calls and results; drops the rest', () => {
  const raw = [
    { type: 'mode' },
    { type: 'user', message: { content: 'hi' } },
    { type: 'assistant', message: { content: [{ type: 'thinking', thinking: '' }, { type: 'text', text: 'yo' }, { type: 'tool_use', name: 'Read', input: { a: 1 } }] } },
    { type: 'user', message: { content: [{ type: 'tool_result', content: 'ok' }] } },
    { type: 'assistant', isSidechain: true, message: { content: 'sub' } },
  ].map(JSON.stringify).join('\n') + '\nnot json'
  assert.deepStrictEqual(parseTranscript(raw).map(m => m.kind), ['text', 'text', 'tool', 'result'])
})

test('parseCodex keeps messages and tool items, drops developer and environment noise', () => {
  const item = payload => JSON.stringify({ type: 'response_item', payload })
  const raw = [
    item({ type: 'message', role: 'developer', content: [{ type: 'input_text', text: 'rules' }] }),
    item({ type: 'message', role: 'user', content: [{ type: 'input_text', text: '<environment_context>x</environment_context>' }] }),
    item({ type: 'message', role: 'user', content: [{ type: 'input_text', text: 'hi' }] }),
    item({ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'yo' }] }),
    item({ type: 'function_call', name: 'shell', arguments: '{}' }),
    item({ type: 'function_call_output', output: 'ok' }),
  ].join('\n')
  assert.deepStrictEqual(parseCodex(raw).map(m => m.kind), ['text', 'text', 'tool', 'result'])
})
