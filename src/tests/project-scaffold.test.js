const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const { makeTempDir } = require('./helpers/temp-dir')
const { createProjectFromScaffold, ensureBundledSkills } = require('../main/services/ProjectScaffoldService')

test('new projects copy the bundled scaffold without overwriting existing folders', async (t) => {
  const root = makeTempDir('ace-project-scaffold-')
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))

  const scaffoldDir = path.join(root, 'scaffold')
  fs.mkdirSync(path.join(scaffoldDir, '.claude'), { recursive: true })
  fs.writeFileSync(path.join(scaffoldDir, 'AGENTS.md'), 'agent guide')
  fs.writeFileSync(path.join(scaffoldDir, '.claude', 'PROJECT_RULES.md'), 'rules')
  fs.writeFileSync(path.join(scaffoldDir, '.claude', '.ace-gitkeep'), '')

  const result = await createProjectFromScaffold({ name: 'My Project', parentDir: root, scaffoldDir })
  assert.equal(fs.readFileSync(path.join(result.path, 'AGENTS.md'), 'utf8'), 'agent guide')
  assert.equal(fs.readFileSync(path.join(result.path, '.claude', 'PROJECT_RULES.md'), 'utf8'), 'rules')
  assert.equal(fs.existsSync(path.join(result.path, '.claude', '.gitkeep')), true)
  assert.equal(fs.existsSync(path.join(result.path, '.claude', '.ace-gitkeep')), false)
  assert.equal(fs.existsSync(path.join(result.path, 'build', '.gitkeep')), true)
  assert.equal(fs.existsSync(path.join(result.path, 'releases', '.gitkeep')), true)
  // One-shot marker that triggers the guided /project-setup interview.
  assert.equal(fs.existsSync(path.join(result.path, '.claude', '.needs-setup')), true)

  const collision = await createProjectFromScaffold({ name: 'My Project', parentDir: root, scaffoldDir })
  assert.match(collision.error, /already exists/)
  assert.match((await createProjectFromScaffold({ name: '..', parentDir: root, scaffoldDir })).error, /must not contain a path/)
  assert.match((await createProjectFromScaffold({ name: 42, parentDir: root, scaffoldDir })).error, /Missing project name/)
})

test('bundled skills are copied into a project that lacks them, cache wins over template, own copies are kept', (t) => {
  const root = makeTempDir('ace-bundled-skills-')
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))

  const skillsRel = path.join('.claude', 'skills')
  const scaffoldDir = path.join(root, 'scaffold')
  const cacheDir = path.join(root, 'home', 'skills-cache')

  // Template ships push-update + a bundled calibrate-enhanced.
  for (const name of ['push-update', 'calibrate-enhanced']) {
    fs.mkdirSync(path.join(scaffoldDir, skillsRel, name), { recursive: true })
    fs.writeFileSync(path.join(scaffoldDir, skillsRel, name, 'SKILL.md'), `bundled ${name}`)
  }
  // Download cache has a fresher calibrate-enhanced + a gauntlet-loop the
  // template doesn't carry, plus the attribution file one level up.
  for (const name of ['calibrate-enhanced', 'gauntlet-loop']) {
    fs.mkdirSync(path.join(cacheDir, name), { recursive: true })
    fs.writeFileSync(path.join(cacheDir, name, 'SKILL.md'), `downloaded ${name}`)
  }
  fs.writeFileSync(path.join(cacheDir, '..', 'THIRD_PARTY_SKILLS.md'), '# credit')

  const project = path.join(root, 'project')
  fs.mkdirSync(project)

  const installed = ensureBundledSkills(project, scaffoldDir, cacheDir)
  assert.deepEqual([...installed].sort(), ['calibrate-enhanced', 'gauntlet-loop', 'push-update'])
  assert.equal(fs.readFileSync(path.join(project, skillsRel, 'push-update', 'SKILL.md'), 'utf8'), 'bundled push-update')
  // Cache copy wins over the template copy for the same skill name.
  assert.equal(fs.readFileSync(path.join(project, skillsRel, 'calibrate-enhanced', 'SKILL.md'), 'utf8'), 'downloaded calibrate-enhanced')
  assert.equal(fs.readFileSync(path.join(project, '.claude', 'THIRD_PARTY_SKILLS.md'), 'utf8'), '# credit')

  // Re-running never overwrites what the project already has.
  fs.writeFileSync(path.join(project, skillsRel, 'calibrate-enhanced', 'SKILL.md'), 'customised')
  assert.deepEqual(ensureBundledSkills(project, scaffoldDir, cacheDir), [])
  assert.equal(fs.readFileSync(path.join(project, skillsRel, 'calibrate-enhanced', 'SKILL.md'), 'utf8'), 'customised')

  // Best-effort: no sources at all is a no-op, never a throw on the spawn path.
  assert.deepEqual(ensureBundledSkills(path.join(root, 'other'), path.join(root, 'nope'), path.join(root, 'nope2')), [])
})
