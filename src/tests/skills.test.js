// Coverage for the SKILL.md frontmatter parser backing ProjectSkillsPanel.jsx.
const assert = require('node:assert/strict')
const test = require('node:test')

async function loadHelpers() {
  return import('../renderer/utils/skills.mjs')
}

test('parseSkillFrontmatter reads name and description', async () => {
  const { parseSkillFrontmatter } = await loadHelpers()
  const content = '---\nname: push-update\ndescription: Turn a change into a PR.\n---\n\n# push-update\nBody text.'
  assert.deepEqual(parseSkillFrontmatter(content), {
    name: 'push-update',
    description: 'Turn a change into a PR.',
  })
})

test('parseSkillFrontmatter tolerates missing fields and no frontmatter', async () => {
  const { parseSkillFrontmatter } = await loadHelpers()
  assert.deepEqual(parseSkillFrontmatter('---\nname: solo\n---\nbody'), { name: 'solo', description: undefined })
  assert.deepEqual(parseSkillFrontmatter('no frontmatter here'), { name: undefined, description: undefined })
  assert.deepEqual(parseSkillFrontmatter(''), { name: undefined, description: undefined })
})
