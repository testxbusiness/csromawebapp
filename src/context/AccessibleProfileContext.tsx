'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'

export type AccessibleProfile = {
  profile: {
    id: string
    first_name: string
    last_name: string
    email: string | null
  }
  relationship: {
    id: string
    type: string
    verified_at: string | null
    permissions: {
      view_schedule: boolean
      confirm_attendance: boolean
      view_payments: boolean
      view_medical_status: boolean
      view_documents: boolean
      sign_documents: boolean
      receive_messages: boolean
    }
  }
}

type AccessibleProfileContextValue = {
  profiles: AccessibleProfile[]
  selectedProfile: AccessibleProfile | null
  selectedProfileId: string | null
  setSelectedProfileId: (profileId: string | null) => void
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

const AccessibleProfileContext = createContext<AccessibleProfileContextValue | null>(null)
const STORAGE_KEY = 'csroma_active_subject_profile_id'

export function appendSubjectProfile(url: string, profileId: string | null) {
  if (!profileId) return url
  const separator = url.includes('?') ? '&' : '?'
  return `${url}${separator}subjectProfileId=${encodeURIComponent(profileId)}`
}

export function AccessibleProfileProvider({ children }: { children: React.ReactNode }) {
  const { account, user } = useAuth()
  const [profiles, setProfiles] = useState<AccessibleProfile[]>([])
  const [selectedProfileId, setSelectedProfileIdState] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!user || !account) {
      setProfiles([])
      setSelectedProfileIdState(null)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/me/accessible-profiles', { cache: 'no-store' })
      const payload = await response.json().catch(() => null) as { profiles?: AccessibleProfile[]; error?: string } | null
      if (!response.ok) throw new Error(payload?.error || 'Impossibile caricare i profili accessibili')
      setProfiles(payload?.profiles ?? [])
    } catch (cause) {
      setProfiles([])
      setError(cause instanceof Error ? cause.message : 'Impossibile caricare i profili accessibili')
    } finally {
      setLoading(false)
    }
  }, [account, user])

  useEffect(() => {
    refresh().catch(() => {})
  }, [refresh])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const stored = window.localStorage.getItem(STORAGE_KEY)
    const stillAccessible = stored && profiles.some((entry) => entry.profile.id === stored)
    setSelectedProfileIdState(stillAccessible ? stored : null)
    if (!stillAccessible) window.localStorage.removeItem(STORAGE_KEY)
  }, [profiles])

  const setSelectedProfileId = useCallback((profileId: string | null) => {
    if (profileId && !profiles.some((entry) => entry.profile.id === profileId)) return
    setSelectedProfileIdState(profileId)
    if (typeof window === 'undefined') return
    if (profileId) window.localStorage.setItem(STORAGE_KEY, profileId)
    else window.localStorage.removeItem(STORAGE_KEY)
  }, [profiles])

  const selectedProfile = useMemo(
    () => profiles.find((entry) => entry.profile.id === selectedProfileId) ?? null,
    [profiles, selectedProfileId]
  )

  const value = useMemo(() => ({
    profiles,
    selectedProfile,
    selectedProfileId,
    setSelectedProfileId,
    loading,
    error,
    refresh,
  }), [error, loading, profiles, refresh, selectedProfile, selectedProfileId, setSelectedProfileId])

  return <AccessibleProfileContext.Provider value={value}>{children}</AccessibleProfileContext.Provider>
}

export function useAccessibleProfiles() {
  const context = useContext(AccessibleProfileContext)
  if (!context) throw new Error('useAccessibleProfiles deve essere utilizzato dentro AccessibleProfileProvider')
  return context
}
