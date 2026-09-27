// Usage is written during/after a reply. Coalesce output bursts from all agents
// and read after a quiet gap; no timer keeps running while ACE is idle.
export function watchUsageActivity(api, refresh) {
  let timer
  const schedule = () => {
    clearTimeout(timer)
    timer = setTimeout(refresh, 3000)
  }
  const unsubscribe = [
    api.terminal.onData(({ chunk }) => { if (chunk) schedule() }),
    api.terminal.onExit(schedule),
    api.onAgentActivity(schedule),
  ]
  refresh()
  return () => {
    clearTimeout(timer)
    unsubscribe.forEach(remove => remove())
  }
}
