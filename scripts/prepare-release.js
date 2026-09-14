const { spawnSync } = require('node:child_process')
const path = require('node:path')

function prepareRelease(root, reviewedCommit, run = spawnSync) {
  const execute = (command, args, cwd = root) => {
    const result = run(command, args, { cwd, encoding: 'utf8', windowsHide: true })
    if (result.status !== 0) throw new Error(result.stderr || result.error?.message || `${command} failed`)
    return (result.stdout || '').trim()
  }
  if (!/^[a-f0-9]{40}$/.test(reviewedCommit || '')) throw new Error('Pass the full reviewed commit SHA')
  if (execute('git', ['rev-parse', 'HEAD']) !== reviewedCommit) throw new Error('HEAD is not the reviewed commit')
  if (execute('git', ['status', '--porcelain'])) throw new Error('Release requires a clean working tree')
  const npm = process.platform === 'win32' ? 'cmd.exe' : 'npm'
  const args = (...values) => process.platform === 'win32' ? ['/d', '/s', '/c', 'npm', ...values] : values
  const src = path.join(root, 'src')
  execute(npm, args('ci'), src)
  execute(npm, args('test'), src)
  execute(npm, args('run', 'package'), src)
  if (execute('git', ['status', '--porcelain'])) throw new Error('Build modified tracked or unignored files; review them before releasing')
  return 'Package verified locally. Tagging and publishing are separate explicit actions.'
}

if (require.main === module) {
  try { console.log(prepareRelease(path.resolve(__dirname, '..'), process.argv[2])) }
  catch (error) { console.error(error.message); process.exitCode = 1 }
}
module.exports = { prepareRelease }
