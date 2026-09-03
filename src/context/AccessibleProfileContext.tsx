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
  activeArea: 'personal' | 'family'
  setActiveArea: (area: 'personal' | 'family') => void
  loading: boolean
  profilesLoaded?: boolean
  error: string | null
  refresh: () => Promise<void>
}

const AccessibleProfileContext = createContext<AccessibleProfileContextValue | null>(null)
const STORAGE_KEY = 'csroma_active_subject_profile_id'
export const SUBJECT_CONTEXT_CHANGED_EVENT = 'csroma:subject-context-changed'
export type SubjectContextChangedDetail = { subjectProfileId: string | null }

export function appendSubjectProfile(url: string, profileId: string | null) {
  if (!profileId) return url
  const separator = url.includes('?') ? '&' : '?'
  return `${url}${separator}subjectProfileId=${encodeURIComponent(profileId)}`
}

export function AccessibleProfileProvider({ children }: { children: React.ReactNode }) {
  const { account, user, loading: authLoading } = useAuth()
  const [profiles, setProfiles] = useState<AccessibleProfile[]>([])
  const [selectedProfileId, setSelectedProfileIdState] = useState<string | null>(null)
  const [activeArea, setActiveArea] = useState<'personal' | 'family'>('personal')
  const [loading, setLoading] = useState(false)
  const [profilesLoaded, setProfilesLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    // Wait for Supabase to restore the session before deciding whether the
    // stored subject is still valid. On a full navigation `user` is briefly
    // null even for an authenticated user; clearing localStorage here would
    // lose the selected athlete before the session/profile request completes.
    if (authLoading) return

    // During a silent auth refresh the user can remain available while the
    // account context is being reloaded. Do not clear the selected subject in
    // that transient state: doing so makes the selector fall back to "Il mio
    // profilo" after navigation or visibility changes.
    if (!user) {
      setProfiles([])
      setSelectedProfileIdState(null)
      setActiveArea('personal')
      setProfilesLoaded(true)
      return
    }

    if (!account) return

    setLoading(true)
    setProfilesLoaded(false)
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
      setProfilesLoaded(true)
    }
  }, [account, authLoading, user])

  useEffect(() => {
    refresh().catch(() => {})
  }, [refresh])

  useEffect(() => {
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') refresh().catch(() => {})
    }

    window.addEventListener('focus', refreshWhenVisible)
    document.addEventListener('visibilitychange', refreshWhenVisible)
    return () => {
      window.removeEventListener('focus', refreshWhenVisible)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
    }
  }, [refresh])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!profilesLoaded) return
    const stored = window.localStorage.getItem(STORAGE_KEY)
    const stillAccessible = stored && profiles.some((entry) => entry.profile.id === stored)
    setSelectedProfileIdState(stillAccessible ? stored : null)
    if (!stillAccessible) window.localStorage.removeItem(STORAGE_KEY)
  }, [profiles, profilesLoaded])

  useEffect(() => {
    // A single subject can be opened directly only after the family area has
    // been selected. Dual-role accounts therefore remain in their personal
    // area until the user explicitly switches to family.
    if (!profilesLoaded || activeArea !== 'family' || selectedProfileId || profiles.length !== 1) return
    const profileId = profiles[0].profile.id
    setSelectedProfileIdState(profileId)
    if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, profileId)
  }, [activeArea, profiles, profilesLoaded, selectedProfileId])

  const isFamilyOnlyAccount = Boolean(account?.roles.includes('family_member') && !account?.roles.includes('athlete'))

  useEffect(() => {
    if (!account?.authUserId) return
    setActiveArea(isFamilyOnlyAccount ? 'family' : 'personal')
  }, [account?.authUserId, isFamilyOnlyAccount])

  const setSelectedProfileId = useCallback((profileId: string | null) => {
    if (profileId && !profiles.some((entry) => entry.profile.id === profileId)) return
    if (profileId === selectedProfileId) return
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent<SubjectContextChangedDetail>(SUBJECT_CONTEXT_CHANGED_EVENT, {
        detail: { subjectProfileId: profileId },
      }))
    }
    setSelectedProfileIdState(profileId)
    if (typeof window === 'undefined') return
    if (profileId) window.localStorage.setItem(STORAGE_KEY, profileId)
    else window.localStorage.removeItem(STORAGE_KEY)
  }, [profiles, selectedProfileId])

  const selectedProfile = useMemo(
    () => profiles.find((entry) => entry.profile.id === selectedProfileId) ?? null,
    [profiles, selectedProfileId]
  )

  const value = useMemo(() => ({
    profiles,
    selectedProfile,
    selectedProfileId,
    setSelectedProfileId,
    activeArea,
    setActiveArea,
    loading,
    profilesLoaded,
    error,
    refresh,
  }), [activeArea, error, loading, profiles, profilesLoaded, refresh, selectedProfile, selectedProfileId, setSelectedProfileId])

  return <AccessibleProfileContext.Provider value={value}>{children}</AccessibleProfileContext.Provider>
}

export function useAccessibleProfiles() {
  const context = useContext(AccessibleProfileContext)
  if (!context) throw new Error('useAccessibleProfiles deve essere utilizzato dentro AccessibleProfileProvider')
  return context
}
