# Claude Code hooks

`play-notification.js` plays `assets/notification.wav` (falling back to an OS
sound) on `Stop` / `SubagentStop` / `Notification`. Playback is synchronous —
the hook blocks for the ~2s the clip lasts rather than spawning a detached
player (which never actually made sound on Windows). It's **opt-in** —
`.claude/settings.json` is gitignored so it isn't forced on everyone who opens
this repo.

To enable, add to your own `.claude/settings.json` (or `settings.local.json`):

```json
{
  "hooks": {
    "Stop":         [{ "hooks": [{ "type": "command", "command": "node \"$CLAUDE_PROJECT_DIR/.claude/hooks/play-notification.js\"" }] }],
    "SubagentStop": [{ "hooks": [{ "type": "command", "command": "node \"$CLAUDE_PROJECT_DIR/.claude/hooks/play-notification.js\"", "async": true }] }]
  }
}
```

Mute at runtime by creating `.claude/.notification-muted` (the app's
notification-sound toggle does this for every registered project).
`CLAUDE_HOOK_DEBUG=1` logs to `hook-execution.log`.
