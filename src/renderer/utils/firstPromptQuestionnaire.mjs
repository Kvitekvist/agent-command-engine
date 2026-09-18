// TICKET-0150: turns the four optional questionnaire fields into one prompt
// string, sent through xterm's bracketed paste (see AgentTerminal.jsx) so
// embedded newlines land as real line breaks instead of submitting early.
export function buildFirstPrompt({ topic, description, avoidInclude, doneLooksLike } = {}) {
  const clean = (s) => String(s || '').trim()
  const parts = []
  const t = clean(topic)
  if (t) parts.push(t)
  const d = clean(description)
  if (d) parts.push(`Context: ${d}`)
  const a = clean(avoidInclude)
  if (a) parts.push(`Avoid/include: ${a}`)
  const done = clean(doneLooksLike)
  if (done) parts.push(`Done when: ${done}`)
  return parts.join('\n\n')
}
