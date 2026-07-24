// Random human first names used as default agent labels, so a freshly
// launched agent reads as e.g. "Priya" instead of a generic "Agent 3".
const NAME_POOL = [
  'Marcus', 'Priya', 'Elena', 'Jasper', 'Nadia', 'Felix', 'Ingrid', 'Omar',
  'Cleo', 'Dmitri', 'Sana', 'Theo', 'Yuki', 'Rosa', 'Kwame', 'Mira',
  'Anton', 'Layla', 'Soren', 'Amara', 'Viktor', 'Noor', 'Callum', 'Zara',
  'Hugo', 'Freya', 'Idris', 'Talia', 'Magnus', 'Esme', 'Rafael', 'Junko',
]

// Picks a random name from the pool, preferring one not already in use.
// Falls back to any random name once the pool is exhausted.
export function generateAgentName(existingNames = []) {
  const used = new Set(existingNames)
  const available = NAME_POOL.filter((n) => !used.has(n))
  const pool = available.length > 0 ? available : NAME_POOL
  return pool[Math.floor(Math.random() * pool.length)]
}
