const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

// Restricted CI/sandbox environments can provide an approved writable parent
// directory. Local runs keep Node's normal OS temporary-directory behaviour.
function makeTempDir(prefix) {
  const parent = process.env.ACE_TEST_TMPDIR || os.tmpdir()
  if (!fs.existsSync(parent)) {
    throw new Error(`ACE_TEST_TMPDIR does not exist: ${parent}`)
  }
  return fs.mkdtempSync(path.join(parent, prefix))
}

module.exports = { makeTempDir }
