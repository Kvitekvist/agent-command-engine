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

test('parseTranscript shows base64 image blocks and project image paths', () => {
  const fs = require('node:fs'), os = require('node:os'), path = require('node:path')
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ace-img-'))
  fs.writeFileSync(path.join(dir, 'a.png'), 'x')
  const line = content => JSON.stringify({ type: 'user', message: { content } })
  const kinds = raw => parseTranscript(raw, dir).map(m => m.kind)
  assert.deepStrictEqual(kinds(line([{ type: 'text', text: 'see a.png' }])), ['text', 'image'])
  assert.deepStrictEqual(kinds(line('see a.png')), ['text', 'image']) // terminal prompts are plain strings
  assert.deepStrictEqual(kinds(line([{ type: 'text', text: 'see ../../etc/a.png' }])), ['text'])
  assert.deepStrictEqual(kinds(line([{ type: 'text', text: 'a.png' }, { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'eA==' } }])), ['text', 'image'])
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
