// Coverage for the pure countdown-formatting helpers backing TasksPanel's
// schedule bar (TICKET-0172).
const assert = require('node:assert/strict')
const test = require('node:test')

async function loadHelpers() {
  return import('../renderer/utils/schedule.mjs')
}

test('formatMinutes: splits into hours and minutes, omitting a zero hour', async () => {
  const { formatMinutes } = await loadHelpers()
  assert.equal(formatMinutes(234), '3h 54m')
  assert.equal(formatMinutes(45), '45m')
  assert.equal(formatMinutes(60), '1h 0m')
})

test('describeDelay: counts down to a future timestamp', async () => {
  const { describeDelay } = await loadHelpers()
  const now = Date.parse('2026-10-18T10:00:00.000Z')
  assert.equal(describeDelay('2026-10-18T13:54:00.000Z', now), '3h 54m')
})

test('describeDelay: an elapsed timestamp reads as due now', async () => {
  const { describeDelay } = await loadHelpers()
  const now = Date.parse('2026-10-18T10:00:00.000Z')
  assert.equal(describeDelay('2026-10-18T09:00:00.000Z', now), 'due now')
})
