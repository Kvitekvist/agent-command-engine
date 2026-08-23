#!/usr/bin/env node
// Prints the next free ticket number, checking tickets/open/, tickets/closed/,
// AND origin/main -- not just the local working tree. Exists because two
// concurrent sessions independently picking "highest local number + 1" has
// already caused two real ID collisions in this project (TICKET-0129/0131,
// and a 5-ticket collision at 0365-0369 -- see project_memory.md's
// "Conventions" section). A local-only scan can't see a number another
// session already claimed on origin but hasn't been pulled locally yet.
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..');

function scanDir(dir) {
  if (!fs.existsSync(dir)) return [];
  let nums = [];

  // Scan for files directly in the directory (flat structure)
  const files = fs.readdirSync(dir, { withFileTypes: true });
  nums.push(...files
    .filter(f => f.isFile())
    .map(f => /^(\d{4})-/.exec(f.name))
    .filter(Boolean)
    .map(m => parseInt(m[1], 10)));

  // Scan category subfolders
  const subdirs = files.filter(f => f.isDirectory());
  for (const subdir of subdirs) {
    const subPath = path.join(dir, subdir.name);
    const subFiles = fs.readdirSync(subPath);
    nums.push(...subFiles
      .map(name => /^(\d{4})-/.exec(name))
      .filter(Boolean)
      .map(m => parseInt(m[1], 10)));
  }

  return nums;
}

function highestFromOrigin() {
  try {
    execSync('git fetch origin main', { cwd: REPO_ROOT, stdio: 'ignore' });
    const out = execSync('git ls-tree -r --name-only origin/main -- tickets/open tickets/closed', {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    });
    const nums = out.split('\n')
      .map((p) => /\/(\d{4})-/.exec(p))
      .filter(Boolean)
      .map((m) => parseInt(m[1], 10));
    return nums.length ? Math.max(...nums) : 0;
  } catch (e) {
    console.warn(`WARN: could not check origin/main (${e.message.split('\n')[0]}) -- falling back to local-only. Numbering could still collide with an unpulled remote ticket.`);
    return 0;
  }
}

const localOpen = scanDir(path.join(REPO_ROOT, 'tickets', 'open'));
const localClosed = scanDir(path.join(REPO_ROOT, 'tickets', 'closed'));
const localMax = Math.max(0, ...localOpen, ...localClosed);
const originMax = highestFromOrigin();

const nextNum = Math.max(localMax, originMax) + 1;

if (originMax > localMax) {
  console.warn(`NOTE: origin/main has a higher ticket number (${originMax}) than your local tree (${localMax}) -- pull before creating tickets to stay in sync.`);
}

console.log(`Next free ticket number: ${String(nextNum).padStart(4, '0')}`);
