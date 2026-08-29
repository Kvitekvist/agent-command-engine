#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ticketsDir = path.join(__dirname, '..', 'tickets');
const folders = ['open', 'closed'];

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50);
}

function parseTicket(content) {
  const titleMatch = content.match(/^#\s+TICKET-\d+\s+—\s+(.+)$/m);
  const typeMatch = content.match(/\*\*Type\*\*\s*\n\s*\n\s*(.+)/);

  const title = titleMatch ? titleMatch[1].trim() : 'untitled';
  const type = typeMatch ? typeMatch[1].trim().toLowerCase() : 'feature';

  // Map common types to bug/feature
  const bugTypes = ['bug', 'fix', 'defect', 'issue'];
  const isBug = bugTypes.some(t => type.includes(t));

  return {
    title,
    type: isBug ? 'bug' : 'feature'
  };
}

folders.forEach(folder => {
  const folderPath = path.join(ticketsDir, folder);
  if (!fs.existsSync(folderPath)) return;

  const files = fs.readdirSync(folderPath).filter(f => f.endsWith('.md') && f.startsWith('TICKET-'));

  files.forEach(file => {
    const filePath = path.join(folderPath, file);
    const content = fs.readFileSync(filePath, 'utf8');
    const { title, type } = parseTicket(content);

    const ticketNum = file.match(/TICKET-(\d+)/)[1];
    const titleSlug = slugify(title);
    const newName = `TICKET-${ticketNum}-${type}-${titleSlug}.md`;

    if (file !== newName) {
      const newPath = path.join(folderPath, newName);
      fs.renameSync(filePath, newPath);
      console.log(`${file} → ${newName}`);
    }
  });
});

// Remove archived folder
const archivedPath = path.join(ticketsDir, 'archived');
if (fs.existsSync(archivedPath)) {
  fs.rmSync(archivedPath, { recursive: true });
  console.log('\nRemoved archived folder');
}

console.log('\nDone');
