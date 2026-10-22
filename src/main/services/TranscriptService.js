const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')

// Claude Code appends every turn of a session to
// ~/.claude/projects/<cwd with non-alphanumerics as '-'>/<session-id>.jsonl.
// The chat view renders that file; the PTY stays the source of truth.
// Not a public contract: unknown line types are skipped.

const text = c => typeof c === 'string' ? c : Array.isArray(c) ? c.map(b => b?.text || '').join('') : ''

// Screenshots pasted into the terminal arrive as a file path in the text (and
// as a base64 image block once the CLI attaches them). Show both as images.
const IMG_PATH = /(?:[A-Za-z]:)?[^\s"'`<>|*?()[\]]+\.(?:png|jpe?g|gif|webp)(?![\w])/gi
const MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp' }
const MAX_IMG = 8 * 1024 * 1024

function pathImages(texts, cwd) {
  const root = path.resolve(cwd || '')
  const seen = new Set()
  for (const t of texts) for (const p of t.match(IMG_PATH) || []) {
    const file = path.resolve(root, p)
    if (seen.size >= 4 || !cwd || path.relative(root, file).startsWith('..') || path.isAbsolute(path.relative(root, file))) continue
    try {
      if (fs.statSync(file).size > MAX_IMG) continue
      seen.add(`data:${MIME[path.extname(file).slice(1).toLowerCase()]};base64,${fs.readFileSync(file).toString('base64')}`)
    } catch { /* not a file we can read */ }
  }
  return [...seen]
}

// ponytail: images are re-sent on every 1s poll; cache by path/size if big pastes make the chat view lag.
function parseTranscript(raw, cwd) {
  const out = []
  for (const line of raw.split('\n')) {
    let m
    try { m = JSON.parse(line) } catch { continue }
    const content = m.message?.content
    if (m.isSidechain || (m.type !== 'user' && m.type !== 'assistant') || content == null) continue
    if (typeof content === 'string') { out.push({ role: m.type, kind: 'text', text: content }); continue }
    const texts = [], b64 = []
    for (const b of content) {
      if (b.type === 'text' && b.text) { out.push({ role: m.type, kind: 'text', text: b.text }); texts.push(b.text) }
      else if (b.type === 'image' && b.source?.type === 'base64') b64.push(`data:${b.source.media_type};base64,${b.source.data}`)
      else if (b.type === 'tool_use') out.push({ role: 'assistant', kind: 'tool', name: b.name, input: JSON.stringify(b.input ?? {}).slice(0, 300) })
      else if (b.type === 'tool_result') out.push({ role: 'user', kind: 'result', text: text(b.content).slice(0, 600), error: !!b.is_error })
    }
    for (const src of b64.length ? b64 : pathImages(texts, cwd)) out.push({ role: m.type, kind: 'image', src })
  }
  return out
}

function readTranscript(cwd, sessionId, home = os.homedir()) {
  if (!/^[a-zA-Z0-9-]{1,128}$/.test(sessionId || '')) return []
  const file = path.join(home, '.claude', 'projects', cwd.replace(/[^a-zA-Z0-9]/g, '-'), `${sessionId}.jsonl`)
  try { return parseTranscript(fs.readFileSync(file, 'utf8'), cwd) } catch { return [] }
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
