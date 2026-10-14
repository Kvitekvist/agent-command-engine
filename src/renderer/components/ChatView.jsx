import React, { useEffect, useRef, useState } from 'react'

// Minimal markdown built as React elements (no innerHTML): fenced code,
// headings, bullet/numbered lists, `code`, **bold**, [text](http-url).
// ponytail: no tables, nesting or italics; add marked + DOMPurify if needed.
const INLINE = /(`[^`]+`|\*\*[^*]+\*\*|\[[^\]]+\]\(https?:\/\/[^)\s]+\))/g

function Inline({ text }) {
  return text.split(INLINE).map((p, i) => {
    if (p.length > 2 && p.startsWith('`') && p.endsWith('`')) return <code key={i} className="px-1 rounded bg-border font-mono text-[0.85em]">{p.slice(1, -1)}</code>
    if (p.length > 4 && p.startsWith('**') && p.endsWith('**')) return <strong key={i}>{p.slice(2, -2)}</strong>
    const link = p.match(/^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/)
    if (link) return <a key={i} href={link[2]} className="text-accent underline" onClick={e => { e.preventDefault(); window.ace.shell.openUrl(link[2]) }}>{link[1]}</a>
    return p
  })
}

function Markdown({ text }) {
  const blocks = []
  let para = [], list = null
  const flush = () => {
    if (para.length) blocks.push({ t: 'p', text: para.join('\n') })
    if (list) blocks.push(list)
    para = []; list = null
  }
  const lines = text.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    let m
    if (/^```/.test(line)) {
      flush()
      const code = []
      while (++i < lines.length && !/^```/.test(lines[i])) code.push(lines[i])
      blocks.push({ t: 'code', text: code.join('\n') })
    } else if ((m = line.match(/^(#{1,4})\s+(.*)/))) { flush(); blocks.push({ t: 'h', text: m[2] }) }
    else if ((m = line.match(/^\s*([-*]|\d+\.)\s+(.*)/))) {
      const ordered = m[1] !== '-' && m[1] !== '*'
      if (list && list.ordered !== ordered) flush()
      if (para.length) { blocks.push({ t: 'p', text: para.join('\n') }); para = [] }
      list = list || { t: 'list', ordered, items: [] }
      list.items.push(m[2])
    } else if (!line.trim()) flush()
    else { if (list) flush(); para.push(line) }
  }
  flush()
  return blocks.map((b, i) => {
    if (b.t === 'code') return <pre key={i} className="my-2 p-2 rounded bg-border/60 overflow-x-auto font-mono text-xs">{b.text}</pre>
    if (b.t === 'h') return <div key={i} className="font-semibold mt-2"><Inline text={b.text} /></div>
    if (b.t === 'list') {
      const L = b.ordered ? 'ol' : 'ul'
      return <L key={i} className={`my-1 pl-5 ${b.ordered ? 'list-decimal' : 'list-disc'}`}>{b.items.map((it, j) => <li key={j}><Inline text={it} /></li>)}</L>
    }
    return <div key={i} className="whitespace-pre-wrap my-1"><Inline text={b.text} /></div>
  })
}

function Message({ m }) {
  if (m.kind === 'tool') return <div className="text-xs text-muted font-mono truncate">⚙ {m.name} {m.input}</div>
  if (m.kind === 'result') return (
    <details className="text-xs text-muted">
      <summary className={`cursor-pointer ${m.error ? 'text-red-400' : ''}`}>{m.error ? 'Tool error' : 'Tool result'}</summary>
      <pre className="whitespace-pre-wrap font-mono mt-1">{m.text}</pre>
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
