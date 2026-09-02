#!/usr/bin/env node
/**
 * Cross-platform audio notification hook for Claude Code
 * Plays notification.mp3 when Claude stops or subagents complete
 *
 * Usage: node play-notification.js [--log]
 *
 * Environment:
 *   CLAUDE_HOOK_DEBUG=1  Enable debug logging to hook-execution.log
 */

const { spawn } = require('child_process');
const { existsSync } = require('fs');
const { appendFileSync } = require('fs');
const path = require('path');
const os = require('os');

const DEBUG = process.env.CLAUDE_HOOK_DEBUG === '1' || process.argv.includes('--log');
const LOG_FILE = path.join(__dirname, '..', '..', 'hook-execution.log');
let AUDIO_FILE = path.join(__dirname, '..', '..', 'assets', 'notification.mp3');
const MUTE_MARKER = path.join(__dirname, '.notification-muted');
const VOLUME = 0.7;

// Built-in OS sound, used only if the bundled file is missing (fail-loud, not silent)
function systemFallback() {
  const p = os.platform();
  if (p === 'darwin') return '/System/Library/Sounds/Glass.aiff';
  if (p === 'win32') return path.join(process.env.SystemRoot || 'C:\\Windows', 'Media', 'Windows Notify.wav');
  return null;
}

function log(msg) {
  if (!DEBUG) return;
  const timestamp = new Date().toISOString();
  try {
    appendFileSync(LOG_FILE, `[${timestamp}] play-notification: ${msg}\n`);
  } catch (err) {
    // Silent fail
  }
}

function playMacOS() {
  log(`Playing via afplay: ${AUDIO_FILE}`);
  const child = spawn('afplay', ['-v', String(VOLUME), AUDIO_FILE], {
    detached: true,
    stdio: 'ignore'
  });
  child.unref();
}

function playWindows() {
  const psScript = path.join(__dirname, DEBUG ? 'play-seatbelt-with-logging.ps1' : 'play-seatbelt.ps1');

  if (!existsSync(psScript)) {
    log(`PowerShell script not found: ${psScript}`);
    return;
  }

  log(`Playing via PowerShell: ${psScript}`);
  const child = spawn('powershell.exe', [
    '-NoProfile',
    '-ExecutionPolicy', 'Bypass',
    '-File', psScript,
    AUDIO_FILE,
    String(VOLUME)
  ], {
    detached: true,
    stdio: 'ignore'
  });
  child.unref();
}

function playLinux() {
  const players = [
    { cmd: 'mpg123', args: ['-q', '-g', String(Math.round(VOLUME * 100)), AUDIO_FILE] },
    { cmd: 'ffplay', args: ['-nodisp', '-autoexit', '-volume', String(Math.round(VOLUME * 100)), AUDIO_FILE] },
    { cmd: 'mpv', args: ['--no-video', '--volume', String(VOLUME * 100), AUDIO_FILE] },
    { cmd: 'cvlc', args: ['--play-and-exit', '--volume', String(Math.round(VOLUME * 100 * 256 / 100)), AUDIO_FILE] }
  ];

  for (const player of players) {
    try {
      log(`Trying ${player.cmd}`);
      const child = spawn(player.cmd, player.args, {
        detached: true,
        stdio: 'ignore'
      });
      child.unref();
      log(`Playing via ${player.cmd}`);
      return;
    } catch (err) {
      log(`${player.cmd} not available: ${err.message}`);
    }
  }

  log('No audio player available on Linux');
}

function main() {
  log('Hook triggered');

  if (existsSync(MUTE_MARKER)) {
    log('Notification sounds muted');
    process.exit(0);
  }

  if (!existsSync(AUDIO_FILE)) {
    const fb = systemFallback();
    if (fb && existsSync(fb)) {
      log(`Bundled audio missing, falling back to system sound: ${fb}`);
      AUDIO_FILE = fb;
    } else {
      log(`Audio file not found: ${AUDIO_FILE}`);
      process.exit(0);
    }
  }

  const platform = os.platform();
  log(`Platform: ${platform}`);

  try {
    if (platform === 'darwin') {
      playMacOS();
    } else if (platform === 'win32') {
      playWindows();
    } else {
      playLinux();
    }
    log('Player spawned successfully');
  } catch (err) {
    log(`Error spawning player: ${err.message}`);
  }

  // Exit immediately, player runs detached
  process.exit(0);
}

main();
