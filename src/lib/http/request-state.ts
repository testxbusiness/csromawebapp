export type RequestState = 'idle' | 'loading' | 'ready' | 'error' | 'denied' | 'offline'

export function requestErrorState(error: unknown): Extract<RequestState, 'error' | 'offline'> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return 'offline'
  if (error instanceof TypeError) return 'offline'
  return 'error'
}

export function responseErrorState(status: number): Extract<RequestState, 'error' | 'denied'> {
  return status === 401 || status === 403 ? 'denied' : 'error'
}
