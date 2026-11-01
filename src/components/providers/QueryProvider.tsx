'use client'

import { useEffect, useRef, useState } from 'react'
import { MutationCache, QueryCache, QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query'
import * as Sentry from '@sentry/nextjs'
import { useAuth } from '@/hooks/useAuth'

function shouldCaptureQueryError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return true

  const candidate = error as { status?: unknown; statusCode?: unknown; response?: { status?: unknown } }
  const status = candidate.status ?? candidate.statusCode ?? candidate.response?.status
  return typeof status !== 'number' || status < 400 || status >= 500
}

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
    queryCache: new QueryCache({
      onError: (error) => {
        if (shouldCaptureQueryError(error)) Sentry.captureException(error)
      },
    }),
    mutationCache: new MutationCache({
      onError: (error) => {
        if (shouldCaptureQueryError(error)) Sentry.captureException(error)
      },
    }),
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
