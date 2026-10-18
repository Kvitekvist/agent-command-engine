const fs = require('node:fs')
const { randomUUID, createHash } = require('node:crypto')
const { resolveWithinRoot } = require('./ProjectPath')
const { FileService } = require('./FileService')
const TASKS = '.ace/tasks.txt'

async function tasksOperation(root, mutation) {
  const { parseTasks, serializeTasks } = await import('./tasks.mjs')
  // After the import disk operations are synchronous, serializing ACE writers.
  let content = null
  try { content = fs.readFileSync(resolveWithinRoot(root, TASKS), 'utf8') }
  catch (error) { if (error.code !== 'ENOENT') throw error }
  const tasks = parseTasks(content).map((task, index) => ({
    ...task,
    id: task.id || createHash('sha256').update(JSON.stringify(task) + ':' + index).digest('hex'),
  }))
  if (new Set(tasks.map(task => task.id)).size !== tasks.length) {
    throw new Error('Tasks contain duplicate IDs. Repair the file before making changes.')
  }
  if (!mutation) return { ok: true, tasks }
  if (mutation.type === 'add') {
    if (typeof mutation.text !== 'string' || !mutation.text.trim()) throw new Error('Write a task first')
    tasks.push({ id: randomUUID(), timestamp: mutation.timestamp || new Date().toISOString(), text: mutation.text, done: !!mutation.done })
  } else {
    const index = tasks.findIndex(task => task.id === mutation.id)
    if (index < 0) return { ok: false, error: 'This task changed or was removed. Reload before editing it.', tasks }
    if (mutation.type === 'toggle') {
      tasks[index].done = !tasks[index].done
    } else if (mutation.type === 'delete' || mutation.type === 'edit') {
      if (tasks[index].text !== mutation.expectedText) {
        return { ok: false, error: 'This task changed or was removed. Reload before editing it.', tasks }
      }
      if (mutation.type === 'delete') tasks.splice(index, 1)
      else if (typeof mutation.text === 'string' && mutation.text.trim()) tasks[index].text = mutation.text
      else throw new Error('Invalid task mutation')
    } else throw new Error('Invalid task mutation')
  }
  const result = FileService.writeFile(root, TASKS, serializeTasks(tasks), content)
  return { ...result, tasks }
}

module.exports = { tasksOperation }
