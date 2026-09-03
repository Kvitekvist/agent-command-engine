#!/usr/bin/env node
/**
 * Cross-platform audio notification hook for Claude Code.
 * Plays assets/notification.wav (falling back to an OS sound) on Stop /
 * SubagentStop / Notification.
 *
 * Playback is SYNCHRONOUS on purpose. An earlier version spawned the player
 * detached and called process.exit(0) immediately -- on Windows that tore the
 * player down before it produced a single sample, so the hook was silent for
 * months while every "did it fire" check passed. A Stop/Notification hook can
 * afford to block for the ~2s the clip lasts.
 *
 * Env:
 *   CLAUDE_HOOK_DEBUG=1   log to hook-execution.log
 */

const { spawnSync } = require('child_process');
const { existsSync, appendFileSync } = require('fs');
const path = require('path');
const os = require('os');

const DEBUG = process.env.CLAUDE_HOOK_DEBUG === '1' || process.argv.includes('--log');
const LOG_FILE = path.join(__dirname, '..', '..', 'hook-execution.log');
let AUDIO_FILE = path.join(__dirname, '..', '..', 'assets', 'notification.wav');
// <project>/.claude/.notification-muted -- written per registered project by
// the app's `notification_sounds_muted` toggle (settings:set in handlers.js).
const MUTE_MARKER = path.join(__dirname, '..', '.notification-muted');
const VOLUME = 0.7; // honoured on macOS/Linux; Windows SoundPlayer uses system volume

function log(msg) {
  if (!DEBUG) return;
  try {
    appendFileSync(LOG_FILE, `[${new Date().toISOString()}] play-notification: ${msg}\n`);
  } catch (_) { /* ignore */ }
}

// Built-in OS sound, used only if the bundled file is missing (fail-loud).
function systemFallback() {
  const p = os.platform();
  if (p === 'darwin') return '/System/Library/Sounds/Glass.aiff';
  if (p === 'win32') return path.join(process.env.SystemRoot || 'C:\\Windows', 'Media', 'Windows Notify.wav');
  return null;
}

function run(cmd, args) {
  log(`run: ${cmd} ${args.join(' ')}`);
  const r = spawnSync(cmd, args, { stdio: 'ignore', timeout: 15000 });
  log(`  -> status=${r.status} error=${r.error ? r.error.message : 'none'}`);
  return !r.error && r.status === 0;
}

function playWindows() {
  // SoundPlayer.PlaySync == WinMM PlaySound(SND_SYNC): no window handle, no COM
  // apartment, blocks until the clip ends. WAV only. -Sta so the call is happy.
  const wav = AUDIO_FILE.replace(/'/g, "''");
  return run('powershell.exe', [
    '-NoProfile', '-ExecutionPolicy', 'Bypass', '-Sta', '-Command',
    `(New-Object System.Media.SoundPlayer '${wav}').PlaySync()`,
  ]);
}

function playMacOS() {
  return run('afplay', ['-v', String(VOLUME), AUDIO_FILE]);
}

function playLinux() {
  const pct = String(Math.round(VOLUME * 100));
  const players = [
    ['paplay', [AUDIO_FILE]],
    ['aplay', ['-q', AUDIO_FILE]],
    ['ffplay', ['-nodisp', '-autoexit', '-loglevel', 'quiet', '-volume', pct, AUDIO_FILE]],
    ['mpv', ['--no-video', `--volume=${pct}`, AUDIO_FILE]],
  ];
  for (const [cmd, args] of players) {
    if (run(cmd, args)) return true;
  }
  return false;
}

function main() {
  log('Hook triggered');

  if (existsSync(MUTE_MARKER)) {
    log('Muted (.notification-muted present)');
    process.exit(0);
  }

  if (!existsSync(AUDIO_FILE)) {
    const fb = systemFallback();
    if (fb && existsSync(fb)) {
      log(`Bundled audio missing, using system sound: ${fb}`);
      AUDIO_FILE = fb;
    } else {
      log(`Audio file not found: ${AUDIO_FILE}`);
      process.exit(0);
    }
  }

  const platform = os.platform();
  log(`Platform: ${platform}, file: ${AUDIO_FILE}`);

  const ok =
    platform === 'win32' ? playWindows() :
    platform === 'darwin' ? playMacOS() :
    playLinux();

  log(ok ? 'Playback finished' : 'No player succeeded');
  process.exit(0);
}

main();
