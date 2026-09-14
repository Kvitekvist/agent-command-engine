const fs = require('node:fs')
const path = require('node:path')

function contains(root, target) {
  const relative = path.relative(root, target)
  return relative === '' || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative))
}

// Resolve missing children through the nearest existing parent. lstat keeps
// dangling links from masquerading as missing ordinary directories.
function realDestination(target) {
  try {
    fs.lstatSync(target)
    return fs.realpathSync.native(target)
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
    try { fs.lstatSync(target); throw new Error('Dangling project link') }
    catch (entryError) { if (entryError.code !== 'ENOENT') throw entryError }
    const parent = path.dirname(target)
    if (parent === target) throw error
    return path.join(realDestination(parent), path.basename(target))
  }
}

function resolveWithinRoot(root, target = '.') {
  const lexicalRoot = path.resolve(root)
  const lexicalTarget = path.resolve(lexicalRoot, target)
  const realRoot = fs.realpathSync.native(lexicalRoot)
  if (!contains(lexicalRoot, lexicalTarget) && !contains(realRoot, lexicalTarget)) {
    throw new Error('Path is outside the project root')
  }
  const realTarget = realDestination(lexicalTarget)
  if (!contains(realRoot, realTarget)) throw new Error('Path is outside the project root')
  return realTarget
}

module.exports = { resolveWithinRoot }
