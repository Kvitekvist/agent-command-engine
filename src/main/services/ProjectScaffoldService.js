const fs = require('node:fs')
const path = require('node:path')
const { resolveWithinRoot } = require('./ProjectPath')

// Where the bundled project scaffold lives: inside app.asar in development,
// shipped as an unpacked application resource in a packaged build (see
// electron-builder's extraResources). Project creation and the bundled-skill
// install both read from it, so neither depends on an external,
// machine-specific template folder. `electron` is required lazily so this
// module stays importable from plain node tests.
function getScaffoldDir() {
  const { app } = require('electron')
  return app.isPackaged
    ? path.join(process.resourcesPath, 'project-template')
    : path.join(app.getAppPath(), 'main', 'project-template')
}

async function restoreGitkeepFiles(dir) {
  for (const entry of await fs.promises.readdir(dir, { withFileTypes: true })) {
    const entryPath = path.join(dir, entry.name)
    if (entry.isDirectory()) await restoreGitkeepFiles(entryPath)
    else if (entry.name === '.ace-gitkeep') {
      await fs.promises.rename(entryPath, path.join(dir, '.gitkeep'))
    }
  }
}

// TICKET-0165: template files that carry the project's identity. Each holds
// {{PLACEHOLDER}} tokens that seedProjectIdentity fills in once, right after
// the copy, so a new project starts out describing itself rather than the
// template.
const SEEDED_FILES = [
  'README.md',
  'AGENTS.md',
  'CHANGELOG.md',
  '.claude/project_config.md',
  '.claude/memory/project_memory.md',
  '.claude/memory/project_status.md',
  'docs/agents/current-state.md',
]
const SUMMARY_MAX = 120

// First line of the description, cut at a word boundary, for one-line slots.
function summarize(description) {
  const firstLine = description.split('\n')[0].trim()
  if (firstLine.length <= SUMMARY_MAX) return firstLine
  const cut = firstLine.slice(0, SUMMARY_MAX)
  return `${cut.slice(0, cut.lastIndexOf(' ') > 40 ? cut.lastIndexOf(' ') : SUMMARY_MAX).trimEnd()}…`
}

// The description is user text written into markdown, never interpreted.
// One regex pass, so a description that itself contains "{{PROJECT_NAME}}"
// or "$&" is copied literally instead of being substituted again.
async function seedProjectIdentity(projectPath, { name, description, createdDate }) {
  const text = description.replace(/\r\n?/g, '\n').trim() || 'Not described yet.'
  const values = {
    PROJECT_NAME: name,
    PROJECT_DESCRIPTION: text,
    PROJECT_SUMMARY: summarize(text),
    CREATED_DATE: createdDate,
  }
  for (const file of SEEDED_FILES) {
    const target = path.join(projectPath, file)
    const content = await fs.promises.readFile(target, 'utf8')
    // A Windows checkout (core.autocrlf) ships the template with CRLF; keep
    // the inserted description on the same line ending as the file.
    const eol = content.includes('\r\n') ? '\r\n' : '\n'
    await fs.promises.writeFile(target, content.replace(/\{\{(PROJECT_NAME|PROJECT_DESCRIPTION|PROJECT_SUMMARY|CREATED_DATE)\}\}/g, (_, key) => values[key].replace(/\n/g, eol)))
  }
}

const NAME_MAX = 100
const DESCRIPTION_MAX = 4000

// TICKET-0164: checks on the wizard's input, run in main before anything is
// created. Returns an error message, or null when the input is usable. The
// character rules are Windows' (the strictest of the supported platforms), so
// a project created on macOS can still be opened there.
function validateNewProject(name, description) {
  if (typeof name !== 'string' || !name.trim()) return 'Enter a folder name.'
  const trimmed = name.trim()
  if (trimmed.length > NAME_MAX) return `Keep the folder name under ${NAME_MAX} characters.`
  if (/[<>:"/\\|?*\x00-\x1f]/.test(trimmed)) return 'The folder name can\'t contain < > : " / \\ | ? * or control characters.'
  if (/[. ]$/.test(trimmed) || trimmed === '.' || trimmed === '..') return 'The folder name can\'t end with a dot or a space.'
  if (/^(con|prn|aux|nul|com\d|lpt\d)(\..*)?$/i.test(trimmed)) return `"${trimmed}" is a reserved name on Windows.`
  if (typeof description !== 'string' || !description.trim()) return 'Describe the project.'
  if (description.trim().length > DESCRIPTION_MAX) return `Keep the description under ${DESCRIPTION_MAX} characters.`
  return null
}

async function createProjectFromScaffold({ name, description = '', parentDir, scaffoldDir, createdDate = new Date().toISOString().slice(0, 10) } = {}) {
  if (typeof name !== 'string' || typeof parentDir !== 'string' || !name.trim() || !parentDir) {
    return { error: 'Missing project name or location' }
  }

  const projectName = name.trim()
  const projectPath = path.resolve(parentDir, projectName)
  if (/[\\/]/.test(projectName) || path.dirname(projectPath) !== path.resolve(parentDir)) {
    return { error: 'Project name must not contain a path' }
  }
  if (!scaffoldDir || !fs.existsSync(scaffoldDir)) {
    return { error: 'The bundled project scaffold is missing' }
  }

  try {
    await fs.promises.mkdir(projectPath)
  } catch (error) {
    if (error.code === 'EEXIST') {
      return { error: 'A folder with this name already exists in the selected location' }
    }
    return { error: error.message }
  }

  try {
    await fs.promises.cp(scaffoldDir, projectPath, {
      recursive: true,
      force: false,
    })
    await restoreGitkeepFiles(projectPath)
    await seedProjectIdentity(projectPath, { name: projectName, description: typeof description === 'string' ? description : '', createdDate })
    for (const emptyDir of ['build', 'releases']) {
      const dir = path.join(projectPath, emptyDir)
      await fs.promises.mkdir(dir, { recursive: true })
      await fs.promises.writeFile(path.join(dir, '.gitkeep'), '')
    }
    // One-shot marker: the first Claude agent ACE opens for this project
    // consumes it (projects:consumeSetupFlag) and auto-runs /project-setup.
    await fs.promises.writeFile(path.join(projectPath, '.claude', '.needs-setup'), '')
    return { path: projectPath }
  } catch (error) {
    await fs.promises.rm(projectPath, { recursive: true, force: true })
    return { error: error.message }
  }
}

// Every slash command a project offers (`/push-update`, `/gauntlet`, ...) only
// exists if that skill's directory is in the project. ACE's own repo carries
// them; a project ACE scaffolded gets them from the template; but a project
// ACE never created had none, so buttons and docs referring to them silently
// did nothing. Copy in every skill the project is missing from the bundled
// template (including the third-party ones -- their licenses (see
// .claude/THIRD_PARTY_SKILLS.md) permit shipping them directly, no runtime
// download needed). Runs on every terminal spawn so projects that predate a
// given skill pick it up too. Best-effort -- an unwritable project just keeps
// what it has. A project's own copy of a skill is never overwritten (a user
// may have adapted the workflow).
function ensureBundledSkills(projectPath, scaffoldDir) {
  const installed = []
  try {
    if (!scaffoldDir) return installed
    const src = path.join(scaffoldDir, '.claude', 'skills')
    if (!fs.existsSync(src)) return installed

    for (const e of fs.readdirSync(src, { withFileTypes: true })) {
      if (!e.isDirectory()) continue
      const from = path.join(src, e.name)
      if (!fs.existsSync(path.join(from, 'SKILL.md'))) continue
      const dest = resolveWithinRoot(projectPath, path.join('.claude', 'skills', e.name))
      if (fs.existsSync(path.join(dest, 'SKILL.md'))) continue
      // Never merge a bundle into an existing tree containing unknown links.
      if (fs.existsSync(dest)) continue
      fs.mkdirSync(path.dirname(dest), { recursive: true })
      fs.cpSync(from, dest, { recursive: true })
      installed.push(e.name)
    }

    // Carry the third-party attribution list into the project so the credit
    // travels with the skills it covers.
    const credit = path.join(scaffoldDir, '.claude', 'THIRD_PARTY_SKILLS.md')
    const creditDest = resolveWithinRoot(projectPath, '.claude/THIRD_PARTY_SKILLS.md')
    if (fs.existsSync(credit) && !fs.existsSync(creditDest)) {
      fs.mkdirSync(path.dirname(creditDest), { recursive: true })
      fs.copyFileSync(credit, creditDest)
    }
  } catch (_) {}
  return installed
}

module.exports = { createProjectFromScaffold, ensureBundledSkills, getScaffoldDir, validateNewProject }
