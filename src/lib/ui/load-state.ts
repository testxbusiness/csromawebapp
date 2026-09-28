export type LoadState = 'ready' | 'error' | 'denied' | 'offline'

export function isOfflineError(error: unknown): boolean {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true
  if (!(error instanceof Error)) return false
  return error.name === 'TypeError' || /network|fetch|offline|connection/i.test(error.message)
}

export function loadStateFromStatus(status: number): Exclude<LoadState, 'ready'> {
  if (status === 401 || status === 403) return 'denied'
  return 'error'
}

export function loadStateFromError(error: unknown): Exclude<LoadState, 'ready'> {
  return isOfflineError(error) ? 'offline' : 'error'
}

export function loadStateFromSupabaseError(error: unknown): Exclude<LoadState, 'ready'> {
  if (typeof error === 'object' && error !== null && 'code' in error && error.code === '42501') {
    return 'denied'
  }
  return loadStateFromError(error)
}
