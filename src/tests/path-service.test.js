const assert = require('node:assert/strict')
const test = require('node:test')

const { parseShellPath, mergePaths, MARKER } = require('../main/services/PathService')

// The login shell prints the PATH wrapped in MARKER on both sides; rc files may
// print banners/MOTD around it, so parseShellPath must pull the value out of
// arbitrary surrounding noise (TICKET-0060).
test('parseShellPath extracts the marked PATH from noisy shell output', () => {
  const path = '/Users/x/.local/bin:/opt/homebrew/bin:/usr/bin:/bin'
  const out = `Welcome to your shell!\n${MARKER}${path}${MARKER}`
  assert.equal(parseShellPath(out), path)
})

test('parseShellPath returns null when the marker is absent or incomplete', () => {
  assert.equal(parseShellPath(''), null)
  assert.equal(parseShellPath(null), null)
  assert.equal(parseShellPath('no markers here'), null)
  // Only an opening marker (shell died mid-print) -- not a usable value.
  assert.equal(parseShellPath(`${MARKER}/usr/bin`), null)
})

test('parseShellPath trims surrounding whitespace but keeps an empty value null', () => {
  assert.equal(parseShellPath(`${MARKER}  /usr/bin  ${MARKER}`), '/usr/bin')
  assert.equal(parseShellPath(`${MARKER}   ${MARKER}`), null)
})

// mergePaths prefers the login-shell ordering but never drops an inherited
// directory the login shell happens to omit (TICKET-0060).
test('mergePaths unions login PATH first, then inherited-only entries, no dupes', () => {
  assert.equal(
    mergePaths('/opt/homebrew/bin:/usr/bin', '/usr/bin:/System/special'),
    '/opt/homebrew/bin:/usr/bin:/System/special',
  )
  assert.equal(mergePaths('/a:/b', ''), '/a:/b')
  assert.equal(mergePaths('', '/a:/b'), '/a:/b')
  assert.equal(mergePaths('', ''), '')
})
