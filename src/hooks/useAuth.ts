'use client'

import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'

type ProfileRow = {
  id: string
  email: string | null
  first_name: string
  last_name: string
  date_of_birth?: string | null
  avatar_url?: string | null
  // Retained only for profile display compatibility; account roles are authoritative.
  role: 'admin' | 'coach' | 'athlete' | string
  must_change_password: boolean | null
  created_at: string | null
  updated_at: string | null
  athlete_profile?: {
    membership_number?: string | null
    medical_certificate_expiry?: string | null
    personal_notes?: string | null
  } | null
}

export type AccountSummary = {
  authUserId: string
  ownerProfileId: string
  accountStatus: 'invited' | 'active' | 'suspended' | 'disabled'
  roles: Array<'admin' | 'coach' | 'staff' | 'athlete' | 'family_member'>
  mustChangePassword: boolean
}

type PersonalProfileData = {
  profile: ProfileRow
  account: AccountSummary | null
}

const PROFILE_CACHE_KEY = 'csroma_profile_cache'
const PROFILE_CACHE_DURATION = 5 * 60 * 1000

function shouldDeferProfileLoad() {
  if (typeof window === 'undefined') return false
  return window.location.pathname === '/auth/callback' || window.location.pathname === '/reset-password'
}

interface UseAuthReturn {
  user: User | null
  session: Session | null
  profile: ProfileRow | null
  account: AccountSummary | null
  role: string | null
  loading: boolean
  profileLoading: boolean
  refreshProfile: () => Promise<void>
  signOut: () => Promise<void>
  forceRefresh: () => Promise<void>
  silentRefresh: () => Promise<void>
}

function useAuthState(): UseAuthReturn {
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current

  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<ProfileRow | null>(null)
  const [account, setAccount] = useState<AccountSummary | null>(null)

  const [authInitialized, setAuthInitialized] = useState(false)
  const [profileLoading, setProfileLoading] = useState(false)

  const lastProfileFor = useRef<string | null>(null)
  const profileRef = useRef<ProfileRow | null>(null)
  const mounted = useRef(true)
  const currentUserIdRef = useRef<string | null>(null)
  const loadingWatchdog = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  useEffect(() => {
    profileRef.current = profile
  }, [profile])

  const loadProfileFromCache = useCallback((userId: string): PersonalProfileData | null => {
    try {
      const cached = sessionStorage.getItem(PROFILE_CACHE_KEY)
      if (!cached) return null

      const { data, timestamp, userId: cachedUserId } = JSON.parse(cached)
      if (cachedUserId !== userId) return null
      if (Date.now() - timestamp > PROFILE_CACHE_DURATION) return null
      if (data?.profile) return data as PersonalProfileData
      return { profile: data as ProfileRow, account: null }
    } catch {
      return null
    }
  }, [])

  const saveProfileToCache = useCallback((userId: string, profileData: PersonalProfileData) => {
    try {
      sessionStorage.setItem(
        PROFILE_CACHE_KEY,
        JSON.stringify({
          data: profileData,
          timestamp: Date.now(),
          userId,
        })
      )
    } catch {
      // ignore storage errors
    }
  }, [])

  const loadProfile = useCallback(
    async (uid: string, skipCache = false) => {
      if (!uid) return
      // During invite callback and mandatory password reset the account may
      // still be in `invited` state. Defer the resolver until the flow has
      // activated the account, avoiding a false 403 and concurrent refreshes.
      if (shouldDeferProfileLoad()) {
        if (mounted.current) setProfileLoading(false)
        return
      }

      if (!skipCache && lastProfileFor.current === uid) {
        console.log('[useAuth] Skipping duplicate profile load for', uid)
        return
      }

      if (!skipCache) {
        const cachedProfile = loadProfileFromCache(uid)
        // Authenticated UI pages require an account-based resolver. Older cache
        // entries containing only the legacy profile must not suppress refresh.
        const cacheHasRequiredAccount = Boolean(cachedProfile?.account)
        if (cachedProfile && cacheHasRequiredAccount) {
          console.log('[useAuth] Profile loaded from cache for', uid)
          setProfile(cachedProfile.profile)
          setAccount(cachedProfile.account)
          lastProfileFor.current = uid
          return
        }
      }

      lastProfileFor.current = uid
      setProfileLoading(true)

      console.log('[useAuth] Loading personal profile from server for', uid)

      try {
        const loadPersonalProfile = async () => {
          const response = await fetch('/api/me/profile', { cache: 'no-store' })
          const payload = (await response.json().catch(() => null)) as
            | { profile?: ProfileRow; account?: AccountSummary; error?: string }
            | null
          return { response, payload }
        }

        let { response, payload } = await loadPersonalProfile()

        if (!mounted.current) return

        if (!response.ok || !payload?.profile) {
          console.warn('[useAuth] Profile load error', payload?.error ?? response.statusText)

          if (response.status === 401) {
            console.warn('[useAuth] Auth error, refreshing session...')
            try {
              const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession()
              if (!refreshError && refreshData.session) {
                console.log('[useAuth] Session refreshed, retrying profile load...')
                lastProfileFor.current = null
                const retryResult = await loadPersonalProfile()
                response = retryResult.response
                payload = retryResult.payload

                if (response.ok && payload?.profile && mounted.current) {
                  console.log('[useAuth] Profile loaded after session refresh')
                  const personalData = { profile: payload.profile, account: payload.account ?? null }
                  setProfile(personalData.profile)
                  setAccount(personalData.account)
                  saveProfileToCache(uid, personalData)
                  return
                }
              }
            } catch (refreshErr) {
              console.error('[useAuth] Session refresh failed:', refreshErr)
            }
          }

          setProfile(null)
          setAccount(null)
          return
        }

        console.log('[useAuth] Personal profile loaded successfully')
        const personalData = { profile: payload.profile, account: payload.account ?? null }
        setProfile(personalData.profile)
        setAccount(personalData.account)
        saveProfileToCache(uid, personalData)
      } finally {
        if (mounted.current) {
          setProfileLoading(false)
        }
      }
    },
    [supabase, loadProfileFromCache, saveProfileToCache]
  )

  const role = useMemo(() => {
    const accountRole = account?.roles.includes('admin')
      ? 'admin'
      : account?.roles.includes('coach')
        ? 'coach'
        : account?.roles.includes('athlete')
          ? 'athlete'
          : account?.roles.includes('staff')
            ? 'staff'
            : account?.roles.includes('family_member')
              ? 'family_member'
              : null
    return accountRole
  }, [account])

  const refreshProfile = useCallback(async () => {
    const uid = currentUserIdRef.current
    if (!uid) return
    lastProfileFor.current = null
    await loadProfile(uid, true)
  }, [loadProfile])

  const forceRefresh = useCallback(async () => {
    setAuthInitialized(false)
    if (loadingWatchdog.current) clearTimeout(loadingWatchdog.current)

    loadingWatchdog.current = setTimeout(() => {
      if (mounted.current) setAuthInitialized(true)
    }, 5000)

    try {
      const { data } = await supabase.auth.getSession()
      if (!mounted.current) return

      setSession(data.session ?? null)
      setUser(data.session?.user ?? null)
      const uid = data.session?.user?.id

      if (uid) {
        lastProfileFor.current = null
        await loadProfile(uid, true)
      } else {
        setProfile(null)
        setAccount(null)
      }
    } finally {
      if (loadingWatchdog.current) {
        clearTimeout(loadingWatchdog.current)
        loadingWatchdog.current = null
      }
      if (mounted.current) setAuthInitialized(true)
    }
  }, [loadProfile, supabase])

  const silentRefresh = useCallback(async () => {
    try {
      const { data } = await supabase.auth.getSession()
      if (!mounted.current) return

      setSession(data.session ?? null)
      setUser(data.session?.user ?? null)
      const uid = data.session?.user?.id

      if (uid) {
        await loadProfile(uid, false)
      } else {
        setProfile(null)
        setAccount(null)
      }
    } catch (e) {
      console.warn('[useAuth] Silent refresh error', e)
    }
  }, [loadProfile, supabase])

  useEffect(() => {
    let unsub: (() => void) | null = null

    const init = async () => {
      if (loadingWatchdog.current) clearTimeout(loadingWatchdog.current)

      loadingWatchdog.current = setTimeout(() => {
        if (mounted.current) setAuthInitialized(true)
      }, 5000)

      try {
        const { data, error } = await supabase.auth.getSession()
        if (!mounted.current) return

        if (error) {
          console.error('[useAuth] getSession error', error)
        }

        setSession(data.session ?? null)
        setUser(data.session?.user ?? null)
        currentUserIdRef.current = data.session?.user?.id ?? null

        if (data.session?.user?.id) {
          setProfileLoading(true)
          await loadProfile(data.session.user.id, false)
        } else {
          setProfile(null)
          setAccount(null)
          setProfileLoading(false)
        }
      } finally {
        if (loadingWatchdog.current) {
          clearTimeout(loadingWatchdog.current)
          loadingWatchdog.current = null
        }
        if (mounted.current) {
          setAuthInitialized(true)
        }
      }

      const { data: sub } = supabase.auth.onAuthStateChange(async (event, _session) => {
        if (!mounted.current) return

        const prevUserId = currentUserIdRef.current
        const nextUserId = _session?.user?.id ?? null
        const sameUser = !!(prevUserId && nextUserId && prevUserId === nextUserId)
        const isRefresh = event === 'TOKEN_REFRESHED'

        setSession(_session ?? null)
        setUser(_session?.user ?? null)
        currentUserIdRef.current = nextUserId

        if (isRefresh && sameUser) {
          if (nextUserId && !profileRef.current) {
            await loadProfile(nextUserId, false)
          }
          return
        }

        if (nextUserId) {
          lastProfileFor.current = null
          setProfileLoading(true)
          await loadProfile(nextUserId, false)
          setProfileLoading(false)
        } else {
          setProfile(null)
          setAccount(null)
          setProfileLoading(false)
          try {
            sessionStorage.removeItem(PROFILE_CACHE_KEY)
          } catch {}
        }
      })

      unsub = () => sub.subscription.unsubscribe()
    }

    init().catch((e) => {
      if (!mounted.current) return
      console.error('[useAuth] Init error', e)
      setAuthInitialized(true)
    })

    return () => {
      unsub?.()
      if (loadingWatchdog.current) clearTimeout(loadingWatchdog.current)
    }
  }, [loadProfile, supabase])

  const lastRefreshTimeRef = useRef<number>(0)
  const visibilityTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let isSubscribed = true

    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      if (visibilityTimeoutRef.current) clearTimeout(visibilityTimeoutRef.current)

      visibilityTimeoutRef.current = setTimeout(async () => {
        if (!isSubscribed || document.visibilityState !== 'visible') return

        const now = Date.now()
        const timeSinceLastRefresh = now - lastRefreshTimeRef.current
        const shouldRefresh = timeSinceLastRefresh > 30000

        if (shouldRefresh) {
          console.log('[useAuth] Refreshing on visibility change')
          try {
            await silentRefresh()
            lastRefreshTimeRef.current = now
          } catch (e) {
            console.warn('[useAuth] Visibility refresh error', e)
          }
        } else {
          console.log(
            '[useAuth] Skipping refresh, last refresh was',
            Math.round(timeSinceLastRefresh / 1000),
            'seconds ago'
          )
        }
      }, 500)
    }

    window.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)

    return () => {
      isSubscribed = false
      if (visibilityTimeoutRef.current) clearTimeout(visibilityTimeoutRef.current)
      window.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [silentRefresh])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setUser(null)
    setSession(null)
    setProfile(null)
    setAccount(null)
    lastProfileFor.current = null
    currentUserIdRef.current = null

    try {
      sessionStorage.removeItem(PROFILE_CACHE_KEY)
    } catch {}
  }, [supabase])

  return {
    user,
    session,
    profile,
    account,
    role,
    loading: !authInitialized,
    profileLoading,
    refreshProfile,
    signOut,
    forceRefresh,
    silentRefresh,
  }
}

const AuthContext = createContext<UseAuthReturn | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const auth = useAuthState()
  return createElement(AuthContext.Provider, { value: auth }, children)
}

export function useAuth(): UseAuthReturn {
  const auth = useContext(AuthContext)
  if (!auth) {
    throw new Error('useAuth deve essere utilizzato all’interno di AuthProvider')
  }
  return auth
}
