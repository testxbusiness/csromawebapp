'use client'

import { useEffect, useRef, useState } from 'react'
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'

export function QuerySessionCacheBoundary({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient()
  const { account, user } = useAuth()
  const sessionKey = user?.id && account?.authUserId ? `${user.id}:${account.authUserId}` : null
  const previousSessionKey = useRef<string | null>(null)

  useEffect(() => {
    if (previousSessionKey.current && previousSessionKey.current !== sessionKey) {
      queryClient.clear()
    }
    previousSessionKey.current = sessionKey
  }, [queryClient, sessionKey])

  return <>{children}</>
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        gcTime: 30 * 60 * 1000,
        refetchOnWindowFocus: true,
      },
    },
  }))

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}
