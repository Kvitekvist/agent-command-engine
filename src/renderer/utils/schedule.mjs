// Pure formatting helpers for TasksPanel's schedule bar (TICKET-0172).

export function minutesToParts(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return { hours, minutes }
}

export function formatMinutes(totalMinutes) {
  const { hours, minutes } = minutesToParts(totalMinutes)
  return (hours ? `${hours}h ` : '') + `${minutes}m`
}

export function describeDelay(nextRunAt, now = Date.now()) {
  const ms = new Date(nextRunAt).getTime() - now
  return ms <= 0 ? 'due now' : formatMinutes(Math.round(ms / 60000))
}
