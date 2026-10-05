type RefreshTask = () => void | Promise<void>

type RefreshEntry = {
  promise: Promise<void> | null
  lastStartedAt: number
}

const entries = new Map<string, RefreshEntry>()

/** Coalesces refreshes caused by focus, visibility and online events. */
export function runClientRefresh(key: string, task: RefreshTask, freshnessMs = 1500, force = false): Promise<void> {
  const now = Date.now()
  const current = entries.get(key)

  if (current?.promise) return current.promise
  if (!force && current && now - current.lastStartedAt < freshnessMs) return Promise.resolve()

  const entry: RefreshEntry = { promise: null, lastStartedAt: now }
  const promise = Promise.resolve().then(task).finally(() => {
    if (entries.get(key) === entry) {
      entry.promise = null
    }
  })
  entry.promise = promise
  entries.set(key, entry)
  return promise
}

export function resetClientRefreshCoordinator(): void {
  entries.clear()
}
