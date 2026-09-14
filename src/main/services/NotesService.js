const fs = require('node:fs')
const { randomUUID, createHash } = require('node:crypto')
const { resolveWithinRoot } = require('./ProjectPath')
const { FileService } = require('./FileService')
const NOTES = '.ace/notes.txt'

async function notesOperation(root, mutation) {
  const { parseNotes, serializeNotes } = await import('./notes.mjs')
  // After the import disk operations are synchronous, serializing ACE writers.
  let content = null
  try { content = fs.readFileSync(resolveWithinRoot(root, NOTES), 'utf8') }
  catch (error) { if (error.code !== 'ENOENT') throw error }
  const notes = parseNotes(content).map((note, index) => ({
    ...note,
    id: note.id || createHash('sha256').update(JSON.stringify(note) + ':' + index).digest('hex'),
  }))
  if (new Set(notes.map(note => note.id)).size !== notes.length) {
    throw new Error('Notes contain duplicate IDs. Repair the file before making changes.')
  }
  if (!mutation) return { ok: true, notes }
  if (mutation.type === 'add') {
    if (typeof mutation.text !== 'string' || !mutation.text.trim()) throw new Error('Write a note first')
    notes.push({ id: randomUUID(), timestamp: mutation.timestamp || new Date().toISOString(), text: mutation.text })
  } else {
    const index = notes.findIndex(note => note.id === mutation.id)
    if (index < 0 || notes[index].text !== mutation.expectedText) {
      return { ok: false, error: 'This note changed or was removed. Reload before editing it.', notes }
    }
    if (mutation.type === 'delete') notes.splice(index, 1)
    else if (mutation.type === 'edit' && typeof mutation.text === 'string' && mutation.text.trim()) notes[index].text = mutation.text
    else throw new Error('Invalid note mutation')
  }
  const result = FileService.writeFile(root, NOTES, serializeNotes(notes), content)
  return { ...result, notes }
}

module.exports = { notesOperation }
