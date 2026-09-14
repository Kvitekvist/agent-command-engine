// Project notes use one JSON object per line; body newlines are escaped.
// The legacy timestamp/separator reader remains for existing files.

export function parseNotes(content) {
  if (!content?.trim()) return []
  const normalized = content.replace(/\r\n/g, '\n')
  if (normalized.trimStart().startsWith('{')) {
    return normalized.split('\n').filter(line => line.trim()).map(line => {
      const note = JSON.parse(line)
      if (typeof note.timestamp !== 'string' || typeof note.text !== 'string') throw new Error('Invalid note entry')
      return note
    })
  }
  return normalized.split(/\n---\n(?=\d{4}-\d\d-\d\dT)/).map(block => {
    const newline = block.indexOf('\n')
    return { timestamp: (newline < 0 ? block : block.slice(0, newline)).trim(), text: newline < 0 ? '' : block.slice(newline + 1) }
  })
}

export function serializeNotes(notes) {
  return notes.map(note => JSON.stringify(note)).join('\n') + (notes.length ? '\n' : '')
}
