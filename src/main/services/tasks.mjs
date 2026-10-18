// Project tasks use one JSON object per line, same shape as notes.mjs but
// with a `done` flag and no legacy format to migrate.

export function parseTasks(content) {
  if (!content?.trim()) return []
  return content.replace(/\r\n/g, '\n').split('\n').filter(line => line.trim()).map(line => {
    const task = JSON.parse(line)
    if (typeof task.timestamp !== 'string' || typeof task.text !== 'string') throw new Error('Invalid task entry')
    return { ...task, done: !!task.done }
  })
}

export function serializeTasks(tasks) {
  return tasks.map(task => JSON.stringify(task)).join('\n') + (tasks.length ? '\n' : '')
}
