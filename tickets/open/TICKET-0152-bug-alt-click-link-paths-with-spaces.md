# TICKET-0152 — Alt-click link detection breaks on paths containing a space

**Status**

Awaiting verification

**Type**

Bug

**Priority**

Medium

**Created**

2026-09-18

---

## Description

Reported by the user: Alt-click to open a file/folder link in the terminal
doesn't work when the path contains a space. Follow-up to TICKET-0149, whose
own testing notes flagged that "physical Alt-click were not exercised" live.

---

## Reason

`findFileLinks` (`terminalLinks.mjs`) only preserved embedded spaces for a
path wrapped in `"..."` or `'...'`. Claude and Codex don't print paths that
way in practice — they use markdown code spans (`` `path` ``) or tool-call
summaries (`` Read(path) ``) — so any path with a space fell through to the
plain-token branch, which splits on whitespace and produced two bogus,
non-existent half-paths. Confirmed with a throwaway repro script:
`` `C:\Users\jensr\My Documents\file.js` `` and
`Read(C:\Users\jensr\My Documents\file.js)` both split at "My".

---

## Implementation Plan

* [x] Extend the tokenizer regex in `findFileLinks` to also treat
  backtick-pairs and parenthesis-pairs as space-preserving delimiters, the
  same way `"..."`/`'...'` already were.
* [x] Verify the existing trailing `:line[:col]` stripping still applies
  inside a paren-wrapped tool-call path (`Edit(file.js:12)`).
* [x] Verify plain parenthetical prose (no path shape) still isn't
  linkified — relies on the existing shape filter, not new logic.
* [x] **Live report: still broken** for a genuinely bare, unquoted path
  (`C:\Users\jensr\Documents\VS Projects\ACE\README.md`, printed with no
  delimiter at all) — the exact case the backtick/paren fix explicitly
  didn't cover. Bridge it instead of leaving it as a documented gap: once a
  token looks like the start of a path (contains `\` or `/`), fold the next
  space-separated word back in as long as it also contains a separator
  (the path continues) or completes it as a bare `name.ext` filename,
  stopping at the first word that does neither.
* [x] Add regression coverage to `terminal-links.test.js`.
* [x] `CHANGELOG.md`.

---

## Files Modified

- `src/renderer/utils/terminalLinks.mjs`
- `src/tests/terminal-links.test.js`
- `CHANGELOG.md`

---

## Testing

- `node --test tests/*.test.js` (from `src/`): 120 passed, 1 skipped
  (POSIX-only), 0 failed. `terminal-links.test.js` covers: the reported
  path exactly, trailing prose not being swallowed, multiple embedded
  spaces in one path, two separate bare paths on the same line staying
  separate, and a path-looking word not reaching backwards into an
  unrelated `he/she`.
- `npm run build:renderer`: passed.
- Not yet verified live: Alt-clicking the reported path in the running app.

---

## Result

`findFileLinks` treats `` `...` `` and `(...)` as space-preserving spans
(markdown code spans and `Tool(path)` call summaries), and separately
bridges a genuinely bare, unquoted path across embedded spaces by folding in
adjacent words that still contain a separator or complete the path as a
bare filename — this is the branch that fixes the reported case, since
Claude apparently printed the path with no delimiter at all. Ordinary
prose essentially never contains a literal `\` or `/`, so this doesn't
start swallowing sentences; verified against a two-space Windows path, two
back-to-back bare paths on one line, and a decoy (`he/she`) that must not
get absorbed into an unrelated path before it.

---

## Notes

Not filesystem-verified — a pathological line where several consecutive
words all happen to contain a slash (rare in real prose) could still merge
too far; capped at 12 merges as a bound, not a correctness guarantee.
`ponytail:` if that ever matters in practice, the upgrade is to make the
xterm link provider's callback async and confirm merge candidates via
`window.ace.fs.readDir`/an existence check before linkifying.

---

## Closed

---
