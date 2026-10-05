import { resetClientRefreshCoordinator, runClientRefresh } from './client-refresh-coordinator'

describe('client refresh coordinator', () => {
  beforeEach(() => resetClientRefreshCoordinator())

  it('shares an in-flight refresh for the same key', async () => {
    let resolveTask: (() => void) | undefined
    const task = jest.fn(() => new Promise<void>((resolve) => { resolveTask = resolve }))

    const first = runClientRefresh('messages:user:self', task)
    const second = runClientRefresh('messages:user:self', task)
    await Promise.resolve()
    expect(task).toHaveBeenCalledTimes(1)
    expect(second).toBe(first)

    resolveTask?.()
    await first
  })

  it('keeps distinct subjects independent and suppresses burst duplicates', async () => {
    const selfTask = jest.fn()
    const familyTask = jest.fn()

    await runClientRefresh('messages:user:self', selfTask)
    await runClientRefresh('messages:user:family-1', familyTask)
    await runClientRefresh('messages:user:self', selfTask)

    expect(selfTask).toHaveBeenCalledTimes(1)
    expect(familyTask).toHaveBeenCalledTimes(1)
  })
})
