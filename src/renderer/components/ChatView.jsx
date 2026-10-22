import React, { useEffect, useRef, useState } from 'react'
import { parseBlocks, INLINE, classifyInline } from '../utils/markdown.mjs'

// Markdown built as React elements (no innerHTML); parsing lives in utils/markdown.mjs.
function Inline({ text }) {
  return text.split(INLINE).map((p, i) => {
    if (i % 2 === 0) return p
    const s = classifyInline(p)
    if (s.t === 'code') return <code key={i} className="px-1 rounded bg-border font-mono text-[0.85em] break-words">{s.text}</code>
    if (s.t === 'link') return <a key={i} href={s.href} title={s.href} className="text-accent underline break-all" onClick={e => { e.preventDefault(); window.ace.shell.openUrl(s.href) }}>{s.text}</a>
    if (s.t === 'strong') return <strong key={i}><Inline text={s.text} /></strong>
    if (s.t === 'em') return <em key={i}><Inline text={s.text} /></em>
    if (s.t === 'del') return <del key={i} className="text-muted"><Inline text={s.text} /></del>
    return s.text
  })
}

function CodeBlock({ lang, text }) {
  const [copied, setCopied] = useState(false)
  const copy = () => navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1200) }).catch(() => {})
  return (
    <div className="my-2 rounded border border-border bg-border/40 overflow-hidden">
      <div className="flex items-center justify-between px-2 py-0.5 text-[10px] text-muted border-b border-border">
        <span className="font-mono">{lang || 'text'}</span>
        <button onClick={copy} className="hover:text-white transition-colors">{copied ? 'Copied' : 'Copy'}</button>
      </div>
      <pre className="p-2 overflow-x-auto font-mono text-xs leading-relaxed">{text}</pre>
    </div>
  )
}

const H_SIZE = ['text-base', 'text-[15px]', 'text-sm', 'text-sm', 'text-xs', 'text-xs']

function Blocks({ blocks, tight }) {
  return blocks.map((b, i) => {
    if (b.t === 'code') return <CodeBlock key={i} lang={b.lang} text={b.text} />
    if (b.t === 'h') return <div key={i} className={`font-semibold mt-3 mb-1 first:mt-0 ${H_SIZE[b.level - 1]} ${b.level <= 2 ? 'pb-0.5 border-b border-border' : ''}`}><Inline text={b.text} /></div>
    if (b.t === 'hr') return <hr key={i} className="my-3 border-border" />
    if (b.t === 'quote') return <blockquote key={i} className="my-2 pl-3 border-l-2 border-accent/50 text-muted"><Blocks blocks={b.blocks} /></blockquote>
    if (b.t === 'table') return (
      <div key={i} className="my-2 overflow-x-auto">
        <table className="text-xs border-collapse">
          <thead><tr>{b.head.map((c, k) => <th key={k} style={{ textAlign: b.align[k] || 'left' }} className="px-2 py-1 border border-border bg-border/50 font-semibold"><Inline text={c} /></th>)}</tr></thead>
          <tbody>{b.rows.map((r, j) => <tr key={j} className="even:bg-border/20">{r.map((c, k) => <td key={k} style={{ textAlign: b.align[k] || 'left' }} className="px-2 py-1 border border-border align-top"><Inline text={c} /></td>)}</tr>)}</tbody>
        </table>
      </div>
    )
    if (b.t === 'list') {
      const L = b.ordered ? 'ol' : 'ul'
      return (
        <L key={i} start={b.ordered ? b.start : undefined} className={`${tight ? '' : 'my-1'} pl-5 ${b.ordered ? 'list-decimal' : 'list-disc'}`}>
          {b.items.map((it, j) => (
            <li key={j} className={it.check == null ? '' : 'list-none -ml-5'}>
              {it.check != null && <input type="checkbox" checked={it.check} readOnly className="mr-1.5 align-middle accent-current" />}
              {it.check != null ? <span className="inline-block align-top"><Blocks blocks={it.blocks} tight /></span> : <Blocks blocks={it.blocks} tight />}
            </li>
          ))}
        </L>
      )
    }
    return <div key={i} className={`whitespace-pre-wrap break-words ${tight ? '' : 'my-1'}`}><Inline text={b.text} /></div>
  })
}

function Markdown({ text }) {
  return <Blocks blocks={parseBlocks(text)} />
}

// The input is JSON cut at 300 chars, so pull the telling field by regex
// rather than JSON.parse.
const TOOL_ARG = /"(?:command|file_path|notebook_path|path|pattern|url|query|description|prompt|skill)"\s*:\s*"((?:[^"\\]|\\.)*)/
const toolSummary = input => {
  const m = String(input || '').match(TOOL_ARG)
  if (!m) return input
  try { return JSON.parse(`"${m[1]}"`) } catch { return m[1] }
}

function Message({ m }) {
  if (m.kind === 'tool') return <div className="text-xs text-muted font-mono truncate" title={m.input}>⚙ <span className="text-white/80">{m.name}</span> {toolSummary(m.input)}</div>
  if (m.kind === 'image') return <img src={m.src} alt="pasted screenshot" className={`max-w-[85%] max-h-80 rounded border border-border object-contain ${m.role === 'user' ? 'self-end' : ''}`} />
  if (m.kind === 'result') return (
    <details className="text-xs text-muted">
      <summary className={`cursor-pointer ${m.error ? 'text-red-400' : ''}`}>{m.error ? 'Tool error' : 'Tool result'}</summary>
      <pre className="whitespace-pre-wrap break-words font-mono mt-1 max-h-64 overflow-y-auto">{m.text}</pre>
    </details>
  )
  return m.role === 'user'
    ? <div className="self-end max-w-[85%] rounded-2xl px-3 py-2 bg-accent/20 text-sm"><Markdown text={m.text} /></div>
    : <div className="text-sm"><Markdown text={m.text} /></div>
}

// The CLI's own approval menu, lifted off the terminal screen: answer it here
// by sending the option number (or Esc) to the same PTY.
function PromptCard({ prompt, onChoose, onCancel }) {
  return (
    <div className="shrink-0 mx-2 mb-2 p-3 rounded-lg border border-accent/40 bg-accent/10 text-sm">
      {prompt.question && <div className="mb-2 whitespace-pre-wrap">{prompt.question}</div>}
      <div className="flex flex-col gap-1">
        {prompt.options.map(o => (
          <button key={o.n} onClick={() => onChoose(o.n)}
            className={`text-left text-xs py-1 px-2 rounded border transition-colors hover:bg-border ${o.selected ? 'border-accent/60' : 'border-border'}`}>
            {o.n}. {o.label}
          </button>
        ))}
        <button onClick={onCancel} className="text-left text-xs py-1 px-2 rounded border border-border text-muted hover:bg-border">Cancel (Esc)</button>
      </div>
    </div>
  )
}

// Render of the agent's session log; typing goes to the same PTY.
export default function ChatView({ agentId, onSend, prompt, onChoose, onCancel }) {
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState('')
  const scroller = useRef(null)
  const stick = useRef(true)

  useEffect(() => {
    let alive = true
    const load = async () => {
      const next = await window.ace.terminal.readTranscript(agentId).catch(() => null)
      // ponytail: whole-file re-read each second; tail by byte offset if transcripts get huge.
      if (alive && next) setMessages(prev => prev.length === next.length ? prev : next)
    }
    load()
    const t = setInterval(load, 1000)
    return () => { alive = false; clearInterval(t) }
  }, [agentId])

  useEffect(() => {
    const el = scroller.current
    if (el && stick.current) el.scrollTop = el.scrollHeight
  }, [messages, prompt])

  const submit = () => {
    const text = draft.trim()
    if (!text) return
    onSend(text)
    setDraft('')
    stick.current = true
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div ref={scroller} className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-3 p-3"
        onScroll={e => { const el = e.currentTarget; stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40 }}>
        {messages.length === 0 && <div className="text-xs text-muted">Nothing yet. Messages appear once the agent writes its first turn.</div>}
        {messages.map((m, i) => <Message key={i} m={m} />)}
      </div>
      {prompt && <PromptCard prompt={prompt} onChoose={onChoose} onCancel={onCancel} />}
      <div className="shrink-0 p-2 border-t border-border">
        <textarea className="input h-16 w-full" placeholder="Message the agent… (Enter to send, Shift+Enter for newline)"
          value={draft} onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() } }} />
      </div>
    </div>
  )
}
