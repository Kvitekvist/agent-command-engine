const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const { makeTempDir } = require('./helpers/temp-dir')
const { createProjectFromScaffold, ensureBundledSkills } = require('../main/services/ProjectScaffoldService')

const TEMPLATE_DIR = path.join(__dirname, '..', 'main', 'project-template')
const raw = (...parts) => fs.readFileSync(path.join(...parts), 'utf8')
// Line-ending agnostic: a Windows checkout (core.autocrlf) has a CRLF template.
const read = (...parts) => raw(...parts).replace(/\r\n/g, '\n')
function filesUnder(dir) {
  return fs.readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile())
    .map((entry) => path.join(entry.parentPath ?? entry.path, entry.name))
}

test('new projects copy the bundled template and seed its identity', async (t) => {
  const root = makeTempDir('ace-project-scaffold-')
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  // Replacement patterns and a placeholder inside the description must be
  // copied literally, and CRLF normalised.
  const firstLine = 'Tracks $& invoices for {{PROJECT_NAME}} freelancers.'
  const description = `  ${firstLine}\r\nSecond line: <b>not html</b>.  `
  const literal = `${firstLine}\nSecond line: <b>not html</b>.`

  const result = await createProjectFromScaffold({ name: 'My Project', description, parentDir: root, scaffoldDir: TEMPLATE_DIR, createdDate: '2026-09-30' })
  assert.equal(result.error, undefined)
  const project = result.path

  // Required files and folders survive the copy.
  for (const file of ['AGENTS.md', '.claude/CLAUDE.md', '.claude/PROJECT_RULES.md', '.claude/skills/project-setup/SKILL.md', 'tickets/TEMPLATE.md', 'LICENSE']) {
    assert.equal(fs.existsSync(path.join(project, file)), true, file)
  }
  assert.equal(fs.existsSync(path.join(project, 'tickets', 'open', 'bugs', '.gitkeep')), true)
  assert.equal(filesUnder(project).some((file) => file.endsWith('.ace-gitkeep')), false)
  assert.equal(fs.existsSync(path.join(project, 'build', '.gitkeep')), true)
  assert.equal(fs.existsSync(path.join(project, 'releases', '.gitkeep')), true)
  // One-shot marker that triggers the guided /project-setup interview.
  assert.equal(fs.existsSync(path.join(project, '.claude', '.needs-setup')), true)

  // Seeded files keep one line ending, whichever the template was checked
  // out with, even around the multi-line description.
  for (const file of ['README.md', '.claude/memory/project_memory.md']) {
    const text = raw(project, file)
    assert.equal(text.includes('\r\n') && /[^\r]\n/.test(text), false, `${file} mixes line endings`)
  }

  // Seeded identity.
  assert.equal(read(project, 'README.md').startsWith(`# My Project\n\n${literal}\n`), true)
  assert.equal(read(project, '.claude', 'project_config.md').startsWith('project_name: My Project\n'), true)
  assert.equal(read(project, '.claude', 'memory', 'project_memory.md').includes(`## Project Vision\n\n${literal}\n`), true)
  assert.equal(read(project, 'docs', 'agents', 'current-state.md').includes(`- Product: My Project - ${firstLine}\n`), true)
  assert.equal(read(project, 'CHANGELOG.md').includes('## [0.1.0] - 2026-09-30'), true)
  assert.equal(read(project, 'AGENTS.md').startsWith('# My Project Agent Guide'), true)
  const placeholder = /\{\{(PROJECT_NAME|PROJECT_DESCRIPTION|PROJECT_SUMMARY|CREATED_DATE)\}\}/
  const leftover = filesUnder(project).filter((file) => placeholder.test(read(file).replaceAll(firstLine, '')))
  assert.deepEqual(leftover, [])

  // Neutral history: version 0.1.0, no inherited tickets or ticket history.
  assert.equal(read(project, 'version.txt').trim(), '0.1.0')
  assert.equal(read(project, '.claude', 'memory', 'project_status.md').includes('## Current Version\n\n0.1.0\n'), true)
  assert.doesNotMatch(read(project, '.claude', 'memory', 'ticket_memory.md'), /TICKET-\d/)
  assert.deepEqual(filesUnder(path.join(project, 'tickets', 'open')).filter((file) => file.endsWith('.md')), [])

  // An existing folder is never touched.
  const existing = path.join(root, 'Existing')
  fs.mkdirSync(existing)
  fs.writeFileSync(path.join(existing, 'README.md'), 'mine')
  assert.match((await createProjectFromScaffold({ name: 'Existing', description, parentDir: root, scaffoldDir: TEMPLATE_DIR })).error, /already exists/)
  assert.deepEqual(fs.readdirSync(existing), ['README.md'])
  assert.equal(read(existing, 'README.md'), 'mine')

  assert.match((await createProjectFromScaffold({ name: '..', parentDir: root, scaffoldDir: TEMPLATE_DIR })).error, /must not contain a path/)
  assert.match((await createProjectFromScaffold({ name: 42, parentDir: root, scaffoldDir: TEMPLATE_DIR })).error, /Missing project name/)
})

test('a missing description is seeded as an explicit placeholder', async (t) => {
  const root = makeTempDir('ace-project-scaffold-')
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const result = await createProjectFromScaffold({ name: 'Blank', description: '   ', parentDir: root, scaffoldDir: TEMPLATE_DIR })
  assert.equal(read(result.path, 'README.md').startsWith('# Blank\n\nNot described yet.\n'), true)
})

test('a failed copy removes the half-created project folder', async (t) => {
  const root = makeTempDir('ace-project-scaffold-')
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  // A scaffold missing the seeded files fails during seeding, after the copy.
  const scaffoldDir = path.join(root, 'broken-scaffold')
  fs.mkdirSync(path.join(scaffoldDir, '.claude'), { recursive: true })
  fs.writeFileSync(path.join(scaffoldDir, 'AGENTS.md'), 'agent guide')

  const result = await createProjectFromScaffold({ name: 'Half', description: 'x', parentDir: root, scaffoldDir })
  assert.match(result.error, /ENOENT/)
  assert.equal(fs.existsSync(path.join(root, 'Half')), false)
})

test('bundled skills (including third-party ones) are copied into a project that lacks them, own copies are kept', (t) => {
  const root = makeTempDir('ace-bundled-skills-')
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))

  const skillsRel = path.join('.claude', 'skills')
  const scaffoldDir = path.join(root, 'scaffold')

  // Template ships push-update plus the bundled (not downloaded) third-party
  // calibrate-enhanced, and its own attribution doc for it.
  for (const name of ['push-update', 'calibrate-enhanced']) {
    fs.mkdirSync(path.join(scaffoldDir, skillsRel, name), { recursive: true })
    fs.writeFileSync(path.join(scaffoldDir, skillsRel, name, 'SKILL.md'), `bundled ${name}`)
  }
  fs.mkdirSync(path.join(scaffoldDir, '.claude'), { recursive: true })
  fs.writeFileSync(path.join(scaffoldDir, '.claude', 'THIRD_PARTY_SKILLS.md'), '# credit')

  const project = path.join(root, 'project')
  fs.mkdirSync(project)

  const installed = ensureBundledSkills(project, scaffoldDir)
  assert.deepEqual([...installed].sort(), ['calibrate-enhanced', 'push-update'])
  assert.equal(fs.readFileSync(path.join(project, skillsRel, 'push-update', 'SKILL.md'), 'utf8'), 'bundled push-update')
  assert.equal(fs.readFileSync(path.join(project, skillsRel, 'calibrate-enhanced', 'SKILL.md'), 'utf8'), 'bundled calibrate-enhanced')
  assert.equal(fs.readFileSync(path.join(project, '.claude', 'THIRD_PARTY_SKILLS.md'), 'utf8'), '# credit')

  // Re-running never overwrites what the project already has.
  fs.writeFileSync(path.join(project, skillsRel, 'calibrate-enhanced', 'SKILL.md'), 'customised')
  assert.deepEqual(ensureBundledSkills(project, scaffoldDir), [])
  assert.equal(fs.readFileSync(path.join(project, skillsRel, 'calibrate-enhanced', 'SKILL.md'), 'utf8'), 'customised')

  // Best-effort: a missing scaffold dir is a no-op, never a throw on the spawn path.
  assert.deepEqual(ensureBundledSkills(path.join(root, 'other'), path.join(root, 'nope')), [])
})
