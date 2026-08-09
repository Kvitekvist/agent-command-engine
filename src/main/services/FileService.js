const fs = require('fs')
const path = require('path')

// TICKET-0021: backs the Sidebar file tree + Monaco editor. Every method
// takes the project root the request is scoped to (as reported by the
// renderer's own activeProject.path -- the same value already trusted
// elsewhere, e.g. as a spawned agent/terminal's cwd) and refuses to touch
// anything outside it, so a malformed or path-traversal-crafted request
// can't reach the filesystem beyond the project the user actually opened.
function resolveWithinRoot(root, target) {
  const resolvedRoot = path.resolve(root)
  const resolvedTarget = path.resolve(target ?? root)
  if (resolvedTarget !== resolvedRoot && !resolvedTarget.startsWith(resolvedRoot + path.sep)) {
    throw new Error('Path is outside the project root')
  }
  return resolvedTarget
}

// Above this size, Monaco (and the IPC round-trip) get sluggish for what
// is very likely a generated/binary/log file rather than something a user
// is here to hand-edit -- refuse to load it rather than freezing the UI.
const MAX_READABLE_BYTES = 2 * 1024 * 1024

// Cheap, standard heuristic: a null byte almost never appears in genuine
// text, and reading the file as UTF-8 anyway would just render mojibake.
function looksBinary(buffer) {
  return buffer.subarray(0, 8000).includes(0)
}

class FileService {
  readDir(root, dirPath) {
    const target = resolveWithinRoot(root, dirPath)
    const entries = fs.readdirSync(target, { withFileTypes: true })
    return entries
      .map((entry) => ({
        name: entry.name,
        path: path.join(target, entry.name),
        isDirectory: entry.isDirectory(),
      }))
      .sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
        return a.name.localeCompare(b.name)
      })
  }

  readFile(root, filePath) {
    const target = resolveWithinRoot(root, filePath)
    const stat = fs.statSync(target)
    if (stat.size > MAX_READABLE_BYTES) {
      return { ok: false, reason: 'too-large', size: stat.size }
    }
    const buffer = fs.readFileSync(target)
    if (looksBinary(buffer)) {
      return { ok: false, reason: 'binary', size: stat.size }
    }
    return { ok: true, content: buffer.toString('utf8') }
  }

  writeFile(root, filePath, content) {
    const target = resolveWithinRoot(root, filePath)
    fs.writeFileSync(target, content, 'utf8')
    return { ok: true }
  }
}

module.exports = { FileService: new FileService() }
