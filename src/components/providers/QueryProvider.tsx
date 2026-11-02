'use client'

import { useEffect, useRef, useState } from 'react'
import { MutationCache, QueryCache, QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { captureUnexpectedServerError, type SentryFeature } from '@/lib/sentry/server-capture'

function featureFromKey(key: readonly unknown[]): SentryFeature | null {
  const text = key.filter((part): part is string => typeof part === 'string').join(':').toLowerCase()
  if (text.includes('convocation') || text.includes('championship')) return 'convocations'
  if (text.includes('absence') || text.includes('attendance') || text.includes('event')) return 'absence'
  if (text.includes('message')) return 'messages'
  if (text.includes('auth') || text.includes('profile')) return 'auth'
  return null
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
      onError: (error, query) => {
        const feature = featureFromKey(query.queryKey)
        if (feature) captureUnexpectedServerError(error, feature, 'read', 'client')
      },
    }),
    mutationCache: new MutationCache({
      onError: (error, _variables, _context, mutation) => {
        const feature = featureFromKey(mutation.options.mutationKey ?? [])
        if (feature) captureUnexpectedServerError(error, feature, 'update', 'client')
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
