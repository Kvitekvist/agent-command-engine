// Read/write .claude/settings.local.json -- the personal, git-ignored-by-
// convention scope Claude Code checks last. Toggling a skill/plugin/MCP
// server from ACE's UI writes here rather than the shared .claude/settings.json
// so flipping something off for yourself never touches a file the team commits.
const SETTINGS_LOCAL_PATH = '.claude/settings.local.json'

// TICKET-0166: a file we can't parse is an error, never an empty object --
// writing `{}` plus one toggle over it would wipe the user's other settings.
function parseSettings(raw) {
  let value
  try { value = JSON.parse(raw) } catch (error) { throw new Error(`${SETTINGS_LOCAL_PATH} is not valid JSON: ${error.message}`) }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${SETTINGS_LOCAL_PATH} must contain a JSON object`)
  return value
}

// A missing file is an empty settings object (raw: null); any other read
// failure or unparseable content throws.
export async function readLocalSettings(projectPath) {
  const file = await window.ace.fs.readFile(projectPath, SETTINGS_LOCAL_PATH)
  if (!file?.ok) {
    if (file?.code === 'ENOENT') return { settings: {}, raw: null }
    throw new Error(file?.error || `Could not read ${SETTINGS_LOCAL_PATH}`)
  }
  return { settings: parseSettings(file.content), raw: file.content }
}

// mutate(settings) changes the parsed object in place. `raw` is the text last
// read (null when the file was absent) and goes to the writer as
// expectedContent, so a concurrent edit or creation surfaces as a conflict
// instead of being silently clobbered.
export async function writeLocalSettings(projectPath, raw, mutate) {
  const settings = raw === null ? {} : parseSettings(raw)
  mutate(settings)
  return window.ace.fs.writeFile(projectPath, SETTINGS_LOCAL_PATH, JSON.stringify(settings, null, 2), raw)
}
