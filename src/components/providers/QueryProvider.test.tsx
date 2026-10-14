import { render, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { QuerySessionCacheBoundary } from './QueryProvider'

jest.mock('@/hooks/useAuth', () => ({ useAuth: jest.fn() }))

const authMock = useAuth as jest.MockedFunction<typeof useAuth>

function setSession(userId: string, accountId: string) {
  authMock.mockReturnValue({
    user: { id: userId } as ReturnType<typeof useAuth>['user'],
    account: { authUserId: accountId } as ReturnType<typeof useAuth>['account'],
  } as ReturnType<typeof useAuth>)
}

describe('QuerySessionCacheBoundary', () => {
  it('clears authenticated query data when the account session changes', async () => {
    const queryClient = new QueryClient()
    setSession('user-a', 'account-a')
    const view = render(
      <QueryClientProvider client={queryClient}>
        <QuerySessionCacheBoundary><div /></QuerySessionCacheBoundary>
      </QueryClientProvider>,
    )

    queryClient.setQueryData(['private', 'account-a'], { value: 'A' })
    setSession('user-b', 'account-b')
    view.rerender(
      <QueryClientProvider client={queryClient}>
        <QuerySessionCacheBoundary><div /></QuerySessionCacheBoundary>
      </QueryClientProvider>,
    )

    await waitFor(() => expect(queryClient.getQueryData(['private', 'account-a'])).toBeUndefined())
  })
})
