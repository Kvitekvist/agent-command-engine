// Pulls name/description out of a SKILL.md's YAML frontmatter (see any file
// under .claude/skills/*/SKILL.md) without a YAML dependency -- every skill's
// frontmatter is just flat `key: value` lines between a pair of `---`s.
export function parseSkillFrontmatter(content) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(content || '')
  const front = match ? match[1] : ''
  const field = (key) => new RegExp(`^${key}:\\s*(.+)$`, 'm').exec(front)?.[1]?.trim()
  return { name: field('name'), description: field('description') }
}
