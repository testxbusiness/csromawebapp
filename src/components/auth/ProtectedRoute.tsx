'use client'

import { ReactNode, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'

interface ProtectedRouteProps {
  children: ReactNode
  requiredRole?: 'admin' | 'coach' | 'athlete'
}

export default function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { user, profile, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    console.log('ProtectedRoute debug:', { loading, user: !!user, profileRole: profile?.role, requiredRole })
    
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
    
    if (!loading && user && requiredRole && profile?.role !== requiredRole) {
      console.log('Redirecting to unauthorized: role mismatch', { 
        userRole: profile?.role, 
        requiredRole 
      })
      router.push('/unauthorized')
    }
  }, [user, loading, profile, requiredRole, router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Caricamento...</div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  if (requiredRole && profile?.role !== requiredRole) {
    return null
  }

  return <>{children}</>
}