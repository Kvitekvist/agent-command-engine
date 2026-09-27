const test = require('node:test')
const assert = require('node:assert/strict')
const { waitForSetup } = require('../../scripts/smoke-installed-setup.cjs')

test('installed setup requires a stable ready screen and rejects the original restart loop and install failures', async () => {
  const ready = { setup: true, prereqs: Object.fromEntries(['node', 'npm', 'git', 'claude', 'codex'].map(name => [name, { present: true }])) }
  const run = (samples, living = () => true) => {
    let time = 0
    let index = 0
    return waitForSetup({
      sample: async () => samples[Math.min(index++, samples.length - 1)], alive: living,
      now: () => time, sleep: async () => { time += 2000 }, timeoutMs: 10000, stableMs: 4000,
    })
  }
  assert.deepEqual(await run([{ setup: true }, ready]), ready)
  await assert.rejects(run([ready], () => false), /exited or restarted/)
  let checks = 0
  await assert.rejects(run([ready], () => ++checks < 3), /exited or restarted/)
  await assert.rejects(run([{ setup: true, errors: ['npm failed'] }]), /npm failed/)
  await assert.rejects(run([{ setup: true }]), /timed out/)
  await assert.rejects(run([{ ...ready, setup: false }]), /never appeared/)
  await assert.rejects(run([ready, { setup: true }, ready, { setup: true }]), /timed out/)
})
