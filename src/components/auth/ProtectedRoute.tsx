'use client'

import { ReactNode, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { LoadingState } from '@/components/ui'

interface ProtectedRouteProps {
  children: ReactNode
  requiredRole?: 'admin' | 'coach' | 'athlete'
}

export default function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { user, profile, role, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    console.log('ProtectedRoute debug:', { loading, user: !!user, role, requiredRole })
    
    if (!loading && !user) {
      console.log('Redirecting to login: no user')
      router.push('/login')
      return
    }
    
    // Wait for profile to load before checking roles
    if (!loading && user && requiredRole && profile === null) {
      console.log('Waiting for profile to load...')
      return
    }
    
    if (!loading && user && requiredRole && role !== requiredRole) {
      console.log('Redirecting to unauthorized: role mismatch', { 
        userRole: role,
        requiredRole 
      })
      router.push('/unauthorized')
    }
  }, [user, loading, profile, role, requiredRole, router])

  if (loading) {
    return <LoadingState label="Verifica autenticazione..." />
  }

  if (!user) {
    return null
  }

  if (requiredRole && role !== requiredRole) {
    return null
  }

  return <>{children}</>
}
