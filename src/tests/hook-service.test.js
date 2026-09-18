require('./helpers/electron-stub')

const assert = require('node:assert/strict')
const test = require('node:test')
const fs = require('node:fs')
const path = require('node:path')
const { spawnSync } = require('node:child_process')

const { ensureHookFiles, readPromptEvents } = require('../main/services/HookService')

// ensureHookFiles() caches, so this whole file exercises one generation.
const h = ensureHookFiles()
const settings = JSON.parse(fs.readFileSync(h.settingsPath, 'utf8'))
const cmds = (event) => settings.hooks[event][0].hooks.map((x) => x.command)

test('both hook scripts are written into userData', () => {
  assert.ok(fs.existsSync(h.scriptPath), 'agent-status.js')
  assert.ok(fs.existsSync(h.soundScriptPath), 'play-notification.js')
  const sound = fs.readFileSync(h.soundScriptPath, 'utf8')
  assert.match(sound, /afplay/)
  assert.match(sound, /SoundPlayer/)
  assert.match(sound, /spawnSync/)
})

test('TICKET-0150: SessionStart runs the questionnaire hook, unmatchered', () => {
  assert.ok(fs.existsSync(h.sessionStartScriptPath), 'session-start.js')
  const script = fs.readFileSync(h.sessionStartScriptPath, 'utf8')
  assert.match(script, /startup/)
  assert.match(script, /clear/)

  const entries = settings.hooks.SessionStart
  assert.equal(entries.length, 1)
  assert.equal(entries[0].matcher, undefined, 'no matcher -- the script filters source itself')
  const c = cmds('SessionStart')
  assert.equal(c.length, 1)
  assert.ok(c[0].includes('session-start.js'))
  assert.ok(c[0].includes('questionnaire'))
  assert.ok(c[0].includes('.questionnaire-disabled'))
})

test('working events get status only; Stop / Notification also play the sound', () => {
  assert.equal(cmds('UserPromptSubmit').length, 2, 'status + prompt-length')
  assert.equal(cmds('PreToolUse').length, 1)
  assert.ok(cmds('UserPromptSubmit').some((c) => c.includes('agent-status.js')))
  assert.ok(cmds('UserPromptSubmit').some((c) => c.includes('prompt-length.js')))
  assert.ok(!cmds('UserPromptSubmit').some((c) => c.includes('play-notification.js')))

  for (const event of ['Stop', 'Notification']) {
    const c = cmds(event)
    assert.equal(c.length, 2, `${event} has status + sound`)
    assert.ok(c.some((x) => x.includes('agent-status.js')), `${event} status`)
    const sound = c.find((x) => x.includes('play-notification.js'))
    assert.ok(sound, `${event} sound`)
    assert.ok(sound.includes('notification.wav'), 'sound cmd passes the audio path')
    assert.ok(sound.includes('.muted'), 'sound cmd passes the mute marker')
  }
})

test('TICKET-0151: prompt-length hook records char/word counts, never the prompt text', () => {
  assert.ok(fs.existsSync(h.promptLengthScriptPath), 'prompt-length.js')
  fs.rmSync(h.promptEventsPath, { force: true })

  const run = (payload) => spawnSync(process.execPath, [h.promptLengthScriptPath, h.promptEventsPath], {
    input: JSON.stringify(payload), encoding: 'utf8',
  })
  const r1 = run({ session_id: 'sess-1', prompt: 'fix the bug' })
  assert.equal(r1.status, 0, r1.stderr)
  const r2 = run({ session_id: 'sess-1', prompt: 'a much longer second prompt with more words in it' })
  assert.equal(r2.status, 0, r2.stderr)

  const raw = fs.readFileSync(h.promptEventsPath, 'utf8')
  assert.ok(!raw.includes('fix the bug'), 'prompt text must never be persisted')

  const events = readPromptEvents()
  const forSession = events.filter((e) => e.session_id === 'sess-1')
  assert.equal(forSession.length, 2)
  assert.equal(forSession[0].chars, 'fix the bug'.length)
  assert.equal(forSession[0].words, 3)
  assert.equal(forSession[1].words, 10)
})

test('the bundled audio is copied in beside the script', () => {
  // dev resolution: <cwd>/../assets/notification.wav -> exists when run from src/
  if (fs.existsSync(path.join(process.cwd(), '..', 'assets', 'notification.wav'))) {
    assert.ok(fs.existsSync(h.audioPath), 'notification.wav copied to ace-hooks/')
  }
})
