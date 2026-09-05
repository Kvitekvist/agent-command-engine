// One-time, pre-window setup gate. On the first launch after an install or an
// update, ACE git-clones every third-party skill listed in the bundled
// .claude/skill-sources.json into <userData>/skills-cache/<name>. The clone is
// the point: it registers in each repo's GitHub "Traffic -> Git clones"
// insights, and each skill's author gets a credit row in THIRD_PARTY_SKILLS.md.
//
// Accepting is mandatory -- decline and ACE quits without opening. If a clone
// still fails after one retry, ACE copies the version bundled in the template
// into the cache and opens with a warning, so a GitHub outage or a missing
// `git` can't permanently brick the app.
//
// ensureBundledSkills() (ProjectScaffoldService) then copies whatever landed in
// the cache into each project's own .claude/skills/ at terminal spawn.

const { app, dialog } = require('electron')
const fs = require('node:fs')
const path = require('node:path')
const { spawnSync } = require('node:child_process')
const { getScaffoldDir } = require('./ProjectScaffoldService')

function readManifest() {
  try {
    const p = path.join(getScaffoldDir(), '.claude', 'skill-sources.json')
    const skills = JSON.parse(fs.readFileSync(p, 'utf8')).skills || {}
    return Object.entries(skills).map(([name, v]) => ({ name, ...v }))
  } catch (_) {
    return []
  }
}

function cacheRoot() {
  return path.join(app.getPath('userData'), 'skills-cache')
}

function markerPath() {
  return path.join(app.getPath('userData'), '.skill-setup-version')
}

function provisionedSha(name) {
  try {
    return fs.readFileSync(path.join(cacheRoot(), name, '.provisioned'), 'utf8').trim()
  } catch (_) {
    return null
  }
}

function git(args, cwd) {
  return spawnSync('git', args, { cwd, encoding: 'utf8', timeout: 120000, windowsHide: true })
}

// Clone one repo, extract its skill files into the cache, and drop a
// .provisioned marker holding the commit sha. subdir === null means the repo
// carries no SKILL.md of its own (the clone is for attribution only) and
// ensureBundledSkills keeps ACE's bundled copy. Returns { ok, sha, error }.
function provision(entry) {
  const dest = path.join(cacheRoot(), entry.name)
  const src = path.join(dest, '_src')
  try {
    fs.rmSync(dest, { recursive: true, force: true })
    fs.mkdirSync(dest, { recursive: true })

    const cl = git(['clone', '--depth', '1', '--branch', entry.ref || 'main', entry.repo, src])
    if (cl.error && cl.error.code === 'ENOENT') return { ok: false, error: 'Git is not installed or not on PATH' }
    if (cl.status !== 0) {
      return { ok: false, error: (cl.stderr || 'clone failed').trim().split('\n').pop() }
    }

    const sha = (git(['rev-parse', 'HEAD'], src).stdout || '').trim()

    if (entry.subdir) {
      const from = path.join(src, entry.subdir)
      if (!fs.existsSync(path.join(from, 'SKILL.md'))) {
        return { ok: false, error: `no SKILL.md at ${entry.subdir}` }
      }
      for (const e of fs.readdirSync(from, { withFileTypes: true })) {
        if (e.name === '.git') continue
        fs.cpSync(path.join(from, e.name), path.join(dest, e.name), { recursive: true })
      }
    }

    fs.rmSync(src, { recursive: true, force: true })
    fs.writeFileSync(path.join(dest, '.provisioned'), sha + '\n')
    return { ok: true, sha }
  } catch (err) {
    return { ok: false, error: String(err && err.message || err) }
  }
}

// Last resort: a clone that keeps failing falls back to the copy bundled in
// the template so the app still opens.
function copyBundledFallback(name) {
  try {
    const from = path.join(getScaffoldDir(), '.claude', 'skills', name)
    if (!fs.existsSync(path.join(from, 'SKILL.md'))) return
    const dest = path.join(cacheRoot(), name)
    fs.rmSync(dest, { recursive: true, force: true })
    fs.cpSync(from, dest, { recursive: true })
    fs.writeFileSync(path.join(dest, '.provisioned'), 'bundled\n')
  } catch (_) {}
}

function writeAttribution(manifest) {
  const rows = manifest.map((m) => {
    const sha = provisionedSha(m.name)
    const commit = sha && sha !== 'bundled' ? '`' + sha.slice(0, 12) + '`' : 'bundled'
    return `| ${m.name} | ${m.author} | ${m.repo} | ${commit} | ${m.license} |`
  })
  const md = [
    '# Third-party skills',
    '',
    "ACE downloads these skills from their authors' repositories on the first",
    'run after an install or update. Each row records the commit fetched on',
    'this machine.',
    '',
    '| Skill | Author | Source | Commit | License |',
    '| --- | --- | --- | --- | --- |',
    ...rows,
    '',
  ].join('\n')
  try {
    fs.writeFileSync(path.join(app.getPath('userData'), 'THIRD_PARTY_SKILLS.md'), md)
  } catch (_) {}
}

// Returns { proceed, usedFallback }. index.js must not open a window when
// proceed is false.
function ensureSkillsProvisioned() {
  const manifest = readManifest()
  const version = app.getVersion()

  let markerHit = false
  try { markerHit = fs.readFileSync(markerPath(), 'utf8').trim() === version } catch (_) {}
  if (!manifest.length || (markerHit && manifest.every((m) => provisionedSha(m.name)))) {
    return { proceed: true, usedFallback: false }
  }

  const consent = dialog.showMessageBoxSync({
    type: 'info',
    buttons: ['Download and continue', 'Quit'],
    defaultId: 0,
    cancelId: 1,
    title: 'ACE — one-time skill setup',
    message: "ACE downloads its skill packs from their authors’ GitHub repositories",
    detail:
      'This gives each author download credit and runs once per version. '
      + 'It needs Git and an internet connection.\n\nSkills: '
      + manifest.map((m) => m.name).join(', '),
  })
  if (consent !== 0) return { proceed: false, usedFallback: false }

  let retried = false
  for (;;) {
    const results = manifest.map((entry) =>
      provisionedSha(entry.name) ? { ...entry, ok: true } : { ...entry, ...provision(entry) })
    const failed = results.filter((r) => !r.ok)

    if (!failed.length) {
      writeAttribution(manifest)
      try { fs.writeFileSync(markerPath(), version + '\n') } catch (_) {}
      return { proceed: true, usedFallback: false }
    }

    if (!retried) {
      retried = true
      const choice = dialog.showMessageBoxSync({
        type: 'warning',
        buttons: ['Retry', 'Quit'],
        defaultId: 0,
        cancelId: 1,
        title: 'ACE — skill download failed',
        message: 'Could not download some skills',
        detail: failed.map((r) => `• ${r.name}: ${r.error}`).join('\n'),
      })
      if (choice !== 0) return { proceed: false, usedFallback: false }
      continue
    }

    // Retry also failed: fall back to the bundled copies and open anyway.
    for (const r of failed) copyBundledFallback(r.name)
    writeAttribution(manifest)
    try { fs.writeFileSync(markerPath(), version + '\n') } catch (_) {}
    dialog.showMessageBoxSync({
      type: 'warning',
      buttons: ['OK'],
      defaultId: 0,
      title: 'ACE — using bundled skills',
      message: 'Some skill repositories could not be reached',
      detail:
        'ACE will use the versions bundled with the app for: '
        + failed.map((r) => r.name).join(', ')
        + '.\n\nIt will try the download again on the next update.',
    })
    return { proceed: true, usedFallback: true }
  }
}

module.exports = { ensureSkillsProvisioned }
