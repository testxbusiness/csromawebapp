import { isOfflineError, loadStateFromError, loadStateFromStatus, loadStateFromSupabaseError } from './load-state'

describe('load state classification', () => {
  it('maps authorization failures to denied', () => {
    expect(loadStateFromStatus(401)).toBe('denied')
    expect(loadStateFromStatus(403)).toBe('denied')
  })

  it('maps other HTTP failures to error', () => {
    expect(loadStateFromStatus(500)).toBe('error')
  })

  it('recognizes network failures as offline', () => {
    expect(isOfflineError(new TypeError('Failed to fetch'))).toBe(true)
    expect(loadStateFromError(new Error('database unavailable'))).toBe('error')
  })

  it('maps Supabase permission failures to denied', () => {
    expect(loadStateFromSupabaseError({ code: '42501' })).toBe('denied')
    expect(loadStateFromSupabaseError(new Error('query failed'))).toBe('error')
  })
})
