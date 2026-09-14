# TICKET-0147: Resolve native Claude npm installations

**Status**

Closed

**Type**

Bug

**Priority**

High

**Created**

2026-09-14

## Description

Terminal startup rejects the installed Claude 2.1.270 npm package, which ships
bin/claude.exe instead of the older cli.js entry point.

## Reason

ProviderExecutable only checks a top-level executable and the old npm JS layout.

## Implementation Plan

- [x] Resolve the native executable inside the Claude npm package before its legacy JS entry.
- [x] Test native npm, legacy npm, PATH precedence and missing installations.
- [x] Run the suite/build and verify resolution against the installed Claude.

## Files Modified

- src/main/services/ProviderExecutable.js
- src/tests/launch-quoting.test.js
- CHANGELOG.md
- This ticket.

## Testing

- npm test: 98 passed, 1 skipped, 0 failed.
- npm run build: passed (existing chunk-size warning).
- Installed Claude resolves to its npm bin/claude.exe and --version returns 2.1.270.
- Interactive terminal UI was not exercised.

## Result

ACE recognizes the installed native Claude npm layout and retains the older JS
layout and PATH precedence. Rebuilt local app output; no installer release or commit.

## Closed

2026-09-14
