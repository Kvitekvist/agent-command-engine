// TICKET-0070: captures the first non-empty line a user submits into a
// freshly-launched agent's terminal, so it can become that agent's
// auto-title. Deliberately a simple parallel reconstruction of the typed
// line, not a real terminal-line emulator -- see TICKET-0070 "Known
// limitation" for why in-line arrow-key edits aren't replayed faithfully.
//
// .mjs (unlike every other renderer util here) so this pure logic can be
// loaded unambiguously as ESM both by Vite (renderer bundle) and directly
// by Node's built-in test runner via dynamic import() -- package.json has
// no "type": "module", so a plain .js file using `export` can't be loaded
// either way without a bundler in between.

const MAX_TITLE_LENGTH = 60

// Strips ANSI/VT escape sequences (arrow keys, Home/End, SGR mouse-tracking
// reports like `ESC[<35;27;28M`, etc. -- all arrive as an ESC-led sequence
// from xterm.js's onData) so they don't get appended to the captured line as
// garbage characters. Matches a leading ESC, then either a full CSI sequence
// or a single following byte (e.g. Alt+key), repeated for as many escape
// sequences as appear in one chunk. The CSI branch follows the general ANSI
// grammar -- parameter bytes 0x30-0x3F (digits and `;:<=>?`), intermediate
// bytes 0x20-0x2F, then a single final byte 0x40-0x7E -- rather than
// assuming digits/`;` come right after `[`, since private-mode sequences
// (like SGR mouse reports, which lead with `<`) otherwise fail to match and
// only the `ESC[` prefix gets stripped, leaving the rest as literal text.
function stripEscapeSequences(data) {
  return data.replace(/\x1b(\[[0-?]*[ -/]*[@-~]|.)/g, '')
}

// Feeds one chunk of raw terminal input (as delivered by xterm's onData) into
// a line-capture buffer. Returns { buffer, line } -- `buffer` is the updated
// in-progress buffer to pass into the next call, `line` is the finalized
// first line (trimmed) once a carriage return/newline is seen, or null if
// the line isn't finished yet (or was empty and should keep waiting).
export function feedLineCapture(buffer, data) {
  const clean = stripEscapeSequences(data)
  let buf = buffer
  for (const ch of clean) {
    if (ch === '\r' || ch === '\n') {
      const line = buf.trim()
      if (line) return { buffer: '', line }
      buf = '' // empty submission (e.g. accidental Enter) -- keep waiting
      continue
    }
    if (ch === '\x7f' || ch === '\b') { // backspace/delete
      buf = buf.slice(0, -1)
      continue
    }
    buf += ch
  }
  return { buffer: buf, line: null }
}

// Truncates a raw first line into a short title: trims, collapses internal
// whitespace, and cuts to the last full word inside MAX_TITLE_LENGTH rather
// than mid-word, appending an ellipsis when it actually truncated anything.
export function deriveTitle(rawLine) {
  const text = rawLine.trim().replace(/\s+/g, ' ')
  if (text.length <= MAX_TITLE_LENGTH) return text
  const cut = text.slice(0, MAX_TITLE_LENGTH)
  const lastSpace = cut.lastIndexOf(' ')
  const trimmed = lastSpace > 0 ? cut.slice(0, lastSpace) : cut
  return trimmed + '…'
}
