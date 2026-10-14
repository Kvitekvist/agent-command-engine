// Finds the CLI's numbered approval menu in the visible terminal rows, e.g.
//   Do you want to proceed?
//   ❯ 1. Yes
//     2. Yes, and don't ask again
//     3. No (esc)
// Same marker as ptyHost.js's auto-answer (❯, › or > before option 1).
const OPTION = /^\s*([❯›>])?\s*(\d+)\.\s+(\S.*?)\s*$/

export function detectPrompt(rows) {
  const lines = rows.map(r => r.replace(/\s+$/, ''))
  let end = lines.length - 1
  while (end >= 0 && !OPTION.test(lines[end])) end--
  if (end < 0) return null
  let start = end
  while (start > 0 && OPTION.test(lines[start - 1])) start--
  const options = lines.slice(start, end + 1).map(l => {
    const m = l.match(OPTION)
    return { n: Number(m[2]), label: m[3], selected: !!m[1] }
  })
  // Needs a pointer on an option and numbering that starts at 1: prose lists don't have both.
  if (options[0].n !== 1 || options.length < 2 || !options.some(o => o.selected)) return null
  const question = lines.slice(Math.max(0, start - 3), start).filter(l => l.trim()).map(l => l.trim()).join('\n')
  return { question, options }
}
