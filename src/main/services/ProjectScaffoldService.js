const fs = require('node:fs')
const path = require('node:path')

async function restoreGitkeepFiles(dir) {
  for (const entry of await fs.promises.readdir(dir, { withFileTypes: true })) {
    const entryPath = path.join(dir, entry.name)
    if (entry.isDirectory()) await restoreGitkeepFiles(entryPath)
    else if (entry.name === '.ace-gitkeep') {
      await fs.promises.rename(entryPath, path.join(dir, '.gitkeep'))
    }
  }
}

async function createProjectFromScaffold({ name, parentDir, scaffoldDir } = {}) {
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

module.exports = { createProjectFromScaffold }
