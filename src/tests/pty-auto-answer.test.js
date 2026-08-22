const assert = require('node:assert/strict')
const test = require('node:test')

const { stripAnsi, PERMISSION_PROMPT_PATTERN } = require('../main/ptyHost')

function isPermissionMenu(output) {
  return PERMISSION_PROMPT_PATTERN.test(stripAnsi(output))
}

test('detects Claude permission menus with the selected first option', () => {
  const output = '\x1b[2K\u276f 1. Yes\r\n  2. Yes, and don\'t ask again\r\n  3. No'
  assert.equal(isPermissionMenu(output), true)
})

test('detects Codex approval menus with its selected-option marker', () => {
  const output = '\x1b[2K\u203a 1. Yes, proceed\r\n  2. Yes, and don\'t ask again\r\n  3. No, and tell Codex what to do differently'
  assert.equal(isPermissionMenu(output), true)
})

test('detects the ASCII fallback used by either CLI in a limited PTY', () => {
  assert.equal(isPermissionMenu('> 1. Allow\r\n  2. Deny (esc)'), true)
})

test('does not treat ordinary numbered output as a permission menu', () => {
  assert.equal(isPermissionMenu('Plan:\r\n1. Read the files\r\n2. Make the change'), false)
})
