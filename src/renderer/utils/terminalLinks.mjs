// A path with a space only survives tokenizing on whitespace if something
// marks its extent. Claude/Codex mark it with markdown code spans
// (`` `path` ``) and tool-call summaries (`` Read(path) ``), treated the
// same as an explicit "..."/'...' quote below. A bare, unquoted path (no
// delimiter at all -- how these CLIs print most paths in plain prose) has
// no such marker, so it's bridged back together instead: ordinary English
// essentially never contains a literal \ or /, so once a token looks like
// the start of a path, the next space-separated word is folded back in as
// long as it still contains a separator (the path continues) or completes
// it as a bare `name.ext` filename -- stopping at the first word that does
// neither, which is what keeps this from swallowing the rest of a sentence.
export function findFileLinks(text) {
  const links = []
  const tokens = /"[^"\r\n]+"|'[^'\r\n]+'|`[^`\r\n]+`|\([^()\r\n]+\)|[^\s`"'<>|()[\]{}]+/g
  const matches = [...text.matchAll(tokens)]
  const MAX_MERGE = 12 // generous for a real path, bounds worst-case scanning

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i]
    const quoted = /^["'`(]/.test(match[0])
    let raw = match[0]
    let end = match.index + raw.length

    if (!quoted && /[\\/]/.test(raw)) {
      for (let merges = 0; merges < MAX_MERGE && i + 1 < matches.length; merges++) {
        const next = matches[i + 1]
        if (text.slice(end, next.index) !== ' ' || /^["'`(]/.test(next[0])) break
        const stripped = next[0].replace(/[,;.!?]+$/, '')
        const continues = /[\\/]/.test(next[0])
        const completes = !continues && /^[\w.-]+\.[a-z\d]+$/i.test(stripped)
        if (!continues && !completes) break
        i++
        end = next.index + next[0].length
        raw = text.slice(match.index, end)
        if (completes) break
      }
    }

    const label = quoted ? raw.slice(1, -1) : raw.replace(/[,;.!?]+$/, '')
    const path = label.replace(/:\d+(?::\d+)?$/, '')
    if (/^[a-z][a-z\d+.-]*:/i.test(path) && !/^[a-z]:[\\/]/i.test(path)) continue
    if (!/[\\/]/.test(path) && !/^[\w.-]+\.[a-z\d]+$/i.test(path)) continue
    if (!/[\w]/.test(path)) continue
    links.push({ path, label, index: match.index + (quoted ? 1 : 0) })
  }
  return links
}

export async function openTerminalLink(event, target, shell, projectPath) {
  if (!event.altKey) return
  event.preventDefault()
  let result
  if (/^https?:/i.test(target)) result = await shell.openUrl(target)
  else {
    if (/^[a-z][a-z\d+.-]*:/i.test(target) && !/^(?:file:|[a-z]:[\\/])/i.test(target)) {
      throw new Error('Unsupported link protocol')
    }
    result = await shell.showInFolder(target, projectPath)
  }
  if (!(result?.ok || result?.success)) throw new Error(result?.error || 'Could not open link')
}
