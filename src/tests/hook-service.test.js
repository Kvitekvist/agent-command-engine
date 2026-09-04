require('./helpers/electron-stub')

const assert = require('node:assert/strict')
const test = require('node:test')
const fs = require('node:fs')
const path = require('node:path')

const { ensureHookFiles } = require('../main/services/HookService')

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

test('working events get status only; Stop / Notification also play the sound', () => {
  assert.equal(cmds('UserPromptSubmit').length, 1)
  assert.equal(cmds('PreToolUse').length, 1)
  assert.ok(!cmds('UserPromptSubmit')[0].includes('play-notification.js'))

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

test('the bundled audio is copied in beside the script', () => {
  // dev resolution: <cwd>/../assets/notification.wav -> exists when run from src/
  if (fs.existsSync(path.join(process.cwd(), '..', 'assets', 'notification.wav'))) {
    assert.ok(fs.existsSync(h.audioPath), 'notification.wav copied to ace-hooks/')
  }
})
