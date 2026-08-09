const fs = require('fs')
const path = require('path')
const { spawn } = require('child_process')
const { shell } = require('electron')

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

// TICKET-0033: extensions the file tree's "Run" context-menu item will
// spawn directly. Kept narrow (Windows-executable-shaped files only) since
// this runs whatever the file contains with no confirmation step.
const RUNNABLE_EXTENSIONS = new Set(['.exe', '.bat', '.cmd', '.ps1', '.vbs', '.com', '.msi'])

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

  // TICKET-0033: reveals the file in Windows Explorer, highlighted/selected
  // -- same as its "Open in Explorer" IPC name implies.
  openInExplorer(root, filePath) {
    const target = resolveWithinRoot(root, filePath)
    shell.showItemInFolder(target)
    return { ok: true }
  }

  // TICKET-0033: runs a file the same way double-clicking it in Explorer
  // would. Deliberately NOT windowsHide'd (unlike this app's own background
  // spawns, see TICKET-0029) -- a user-invoked "Run" should behave like a
  // normal double-click, console window and all, not be silently hidden.
  // .ps1 is special-cased: Explorer's own default double-click verb for
  // PowerShell scripts is "Edit", not "Run" (a deliberate Windows security
  // default), so running one for real needs an explicit powershell.exe
  // invocation rather than relying on the file association.
  runFile(root, filePath) {
    const target = resolveWithinRoot(root, filePath)
    const ext = path.extname(target).toLowerCase()
    if (!RUNNABLE_EXTENSIONS.has(ext)) {
      return { ok: false, error: `"${ext}" files can't be run` }
    }
    const cwd = path.dirname(target)
    const isPs1 = ext === '.ps1'
    const cmd = isPs1 ? 'powershell.exe' : target
    const args = isPs1 ? ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', target] : []
    const child = spawn(cmd, args, {
      cwd,
      detached: true,
      stdio: 'ignore',
      shell: !isPs1 && ext !== '.exe',
    })
    child.on('error', () => {}) // detached + unref'd -- nothing left to report a spawn error to
    child.unref()
    return { ok: true }
  }
}

module.exports = { FileService: new FileService(), RUNNABLE_EXTENSIONS }
