const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')

// Claude Code appends every turn of a session to
// ~/.claude/projects/<cwd with non-alphanumerics as '-'>/<session-id>.jsonl.
// The chat view renders that file; the PTY stays the source of truth.
// Not a public contract: unknown line types are skipped.

const text = c => typeof c === 'string' ? c : Array.isArray(c) ? c.map(b => b?.text || '').join('') : ''

function parseTranscript(raw) {
  const out = []
  for (const line of raw.split('\n')) {
    let m
    try { m = JSON.parse(line) } catch { continue }
    const content = m.message?.content
    if (m.isSidechain || (m.type !== 'user' && m.type !== 'assistant') || content == null) continue
    if (typeof content === 'string') { out.push({ role: m.type, kind: 'text', text: content }); continue }
    for (const b of content) {
      if (b.type === 'text' && b.text) out.push({ role: m.type, kind: 'text', text: b.text })
      else if (b.type === 'tool_use') out.push({ role: 'assistant', kind: 'tool', name: b.name, input: JSON.stringify(b.input ?? {}).slice(0, 300) })
      else if (b.type === 'tool_result') out.push({ role: 'user', kind: 'result', text: text(b.content).slice(0, 600), error: !!b.is_error })
    }
  }
  return out
}

function readTranscript(cwd, sessionId, home = os.homedir()) {
  if (!/^[a-zA-Z0-9-]{1,128}$/.test(sessionId || '')) return []
  const file = path.join(home, '.claude', 'projects', cwd.replace(/[^a-zA-Z0-9]/g, '-'), `${sessionId}.jsonl`)
  try { return parseTranscript(fs.readFileSync(file, 'utf8')) } catch { return [] }
}

// Codex writes ~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl, but ACE never
// passes it a session id. Pair the agent with the newest rollout for its cwd
// that was touched after the agent started. Shape follows the Responses API
// items; function_call/_output are unverified against a real tool-using run.
const codexFiles = new Map() // "cwd|startedAt" -> rollout path
const sameDir = (a, b) => path.resolve(a || '').toLowerCase() === path.resolve(b || '').toLowerCase()
const stripEnv = t => t.replace(/<environment_context>[\s\S]*?<\/environment_context>/g, '').trim()

function parseCodex(raw) {
  const out = []
  for (const line of raw.split('\n')) {
    let m
    try { m = JSON.parse(line) } catch { continue }
    const p = m.type === 'response_item' && m.payload
    if (!p) continue
    if (p.type === 'message' && (p.role === 'user' || p.role === 'assistant')) {
      const t = stripEnv(text(p.content))
      if (t) out.push({ role: p.role, kind: 'text', text: t })
    } else if (p.type === 'function_call') out.push({ role: 'assistant', kind: 'tool', name: p.name, input: String(p.arguments ?? '').slice(0, 300) })
    else if (p.type === 'function_call_output') out.push({ role: 'user', kind: 'result', text: text(p.output).slice(0, 600) })
  }
  return out
}

function findCodexRollout(cwd, startedAt, home) {
  const root = path.join(home, '.codex', 'sessions')
  let best = null
  for (const d of [new Date(startedAt), new Date()]) {
    const dir = path.join(root, String(d.getFullYear()), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0'))
    let names = []
    try { names = fs.readdirSync(dir) } catch { continue }
    for (const n of names) {
      if (!n.startsWith('rollout-') || !n.endsWith('.jsonl')) continue
      const f = path.join(dir, n)
      try {
        const st = fs.statSync(f)
        if (st.mtimeMs < startedAt - 5000 || (best && st.birthtimeMs <= best.t)) continue
        const head = fs.readFileSync(f, 'utf8').slice(0, 20000)
        const m = head.match(/"cwd":"((?:[^"\\]|\\.)*)"/)
        if (m && sameDir(JSON.parse(`"${m[1]}"`), cwd)) best = { f, t: st.birthtimeMs }
      } catch { /* unreadable rollout */ }
    }
  }
  return best?.f
}

function readCodexTranscript(cwd, startedAt, home = os.homedir()) {
  const key = `${cwd}|${startedAt}`
  let file = codexFiles.get(key)
  if (!file) { file = findCodexRollout(cwd, startedAt, home); if (file) codexFiles.set(key, file) }
  try { return file ? parseCodex(fs.readFileSync(file, 'utf8')) : [] } catch { return [] }
}

module.exports = { parseTranscript, readTranscript, parseCodex, readCodexTranscript }
