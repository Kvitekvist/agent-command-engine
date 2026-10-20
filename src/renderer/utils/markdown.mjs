// Block-level markdown for the chat view, parsed to plain objects so the
// renderer builds React elements (no innerHTML). Covers what agents actually
// write: fences, headings, GFM tables, quotes, rules, nested/task lists.
// ponytail: no setext headings, HTML or reference links; swap for marked + DOMPurify if those show up.

const FENCE = /^\s*(`{3,}|~{3,})\s*([\w+#.-]*)/
const HEADING = /^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/
const HR = /^\s{0,3}([-*_])(\s*\1){2,}\s*$/
const QUOTE = /^\s{0,3}>\s?(.*)$/
const ITEM = /^(\s*)([-*+]|\d{1,9}[.)])\s+(.*)$/
const TABLE_SEP = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/

const indentOf = l => l.match(/^\s*/)[0].replace(/\t/g, '    ').length
const isOrdered = marker => /\d/.test(marker)

export function splitRow(line) {
  let s = line.trim()
  if (s.startsWith('|')) s = s.slice(1)
  if (s.endsWith('|') && !s.endsWith('\\|')) s = s.slice(0, -1)
  const cells = []
  let cur = '', code = false
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (c === '\\' && s[i + 1] === '|') { cur += '|'; i++ }
    else if (c === '`') { code = !code; cur += c }
    else if (c === '|' && !code) { cells.push(cur.trim()); cur = '' }
    else cur += c
  }
  cells.push(cur.trim())
  return cells
}

const isTableStart = (lines, i) => lines[i].includes('|') && i + 1 < lines.length && lines[i + 1].includes('-') && TABLE_SEP.test(lines[i + 1])
const startsBlock = (lines, i) => {
  const l = lines[i]
  return FENCE.test(l) || HEADING.test(l) || HR.test(l) || QUOTE.test(l) || ITEM.test(l) || isTableStart(lines, i)
}

export function parseBlocks(text) {
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  const blocks = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    let m
    if (!line.trim()) { i++; continue }

    if ((m = line.match(FENCE))) {
      const close = new RegExp(`^\\s*${m[1][0] === '`' ? '`' : '~'}{${m[1].length},}\\s*$`)
      const pad = indentOf(line)
      const code = []
      while (++i < lines.length && !close.test(lines[i])) code.push(lines[i].replace(new RegExp(`^ {0,${pad}}`), ''))
      i++
      blocks.push({ t: 'code', lang: m[2], text: code.join('\n') })
    } else if ((m = line.match(HEADING))) {
      blocks.push({ t: 'h', level: m[1].length, text: m[2] }); i++
    } else if (HR.test(line)) {
      blocks.push({ t: 'hr' }); i++
    } else if (isTableStart(lines, i)) {
      const head = splitRow(line)
      const align = splitRow(lines[i + 1]).map(c => c.endsWith(':') ? (c.startsWith(':') ? 'center' : 'right') : c.startsWith(':') ? 'left' : null)
      const rows = []
      i += 2
      while (i < lines.length && lines[i].trim() && lines[i].includes('|')) rows.push(splitRow(lines[i++]))
      const width = head.length
      const fit = r => Array.from({ length: width }, (_, k) => r[k] ?? '')
      blocks.push({ t: 'table', head, align: fit(align).map(a => a || null), rows: rows.map(fit) })
    } else if (QUOTE.test(line)) {
      const inner = []
      while (i < lines.length && (m = lines[i].match(QUOTE))) { inner.push(m[1]); i++ }
      blocks.push({ t: 'quote', blocks: parseBlocks(inner.join('\n')) })
    } else if ((m = line.match(ITEM))) {
      const base = indentOf(line)
      const ordered = isOrdered(m[2])
      const list = { t: 'list', ordered, start: ordered ? parseInt(m[2], 10) : 1, items: [] }
      let item = null
      while (i < lines.length) {
        const l = lines[i]
        const im = l.match(ITEM)
        if (im && indentOf(l) <= base + 1) {
          if (isOrdered(im[2]) !== ordered) break
          item = { lines: [im[3]] }
          list.items.push(item)
          i++
        } else if (!l.trim()) {
          // A blank line ends the list unless the next line is still part of it.
          let j = i
          while (j < lines.length && !lines[j].trim()) j++
          if (j >= lines.length) { i = j; break }
          const next = lines[j].match(ITEM)
          if (indentOf(lines[j]) > base + 1 || (next && indentOf(lines[j]) <= base + 1 && isOrdered(next[2]) === ordered)) {
            for (; i < j; i++) item.lines.push('')
          } else break
        } else if (indentOf(l) > base) {
          item.lines.push(l); i++
        } else if (!startsBlock(lines, i)) {
          item.lines.push(l.trim()); i++ // lazy continuation of the item's text
        } else break
      }
      list.items = list.items.map(({ lines: ls }) => {
        const rest = ls.slice(1)
        const pad = Math.min(...rest.filter(l => l.trim()).map(indentOf))
        const body = [ls[0], ...rest.map(l => l.slice(Number.isFinite(pad) ? pad : 0))].join('\n')
        const task = body.match(/^\[([ xX])\]\s+/)
        return { check: task ? task[1] !== ' ' : null, blocks: parseBlocks(task ? body.slice(task[0].length) : body) }
      })
      blocks.push(list)
    } else {
      const para = [line]
      while (++i < lines.length && lines[i].trim() && !startsBlock(lines, i)) para.push(lines[i])
      blocks.push({ t: 'p', text: para.join('\n') })
    }
  }
  return blocks
}

// Inline spans: `code`, [text](url), **bold**, *em*, ~~strike~~, bare URLs.
export const INLINE = /(`+[^`]+?`+|\[[^\]]+\]\(https?:\/\/[^)\s]+\)|\*\*(?=\S)[^*]+?\*\*|__(?=\S)[^_]+?__|~~[^~]+~~|\*(?=[^*\s])[^*]*?[^*\s]\*|\*[^*\s]\*|(?<![\w])_(?=[^_\s])[^_]*?_(?![\w])|https?:\/\/[^\s<>()]*[^\s<>().,;:!?'"*_`])/g

export function classifyInline(p) {
  let m
  if ((m = p.match(/^(`+)([^`][\s\S]*?)\1$/))) return { t: 'code', text: m[2].trim() || m[2] }
  if ((m = p.match(/^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/))) return { t: 'link', text: m[1], href: m[2] }
  if (/^https?:\/\//.test(p)) return { t: 'link', text: p, href: p }
  if (p.length > 4 && (/^\*\*.*\*\*$/s.test(p) || /^__.*__$/s.test(p))) return { t: 'strong', text: p.slice(2, -2) }
  if (p.length > 4 && /^~~.*~~$/s.test(p)) return { t: 'del', text: p.slice(2, -2) }
  if (p.length > 2 && (/^\*.*\*$/s.test(p) || /^_.*_$/s.test(p))) return { t: 'em', text: p.slice(1, -1) }
  return { t: 'text', text: p }
}
