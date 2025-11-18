'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'

type ProfileRow = {
  id: string
  email: string
  first_name: string
  last_name: string
  role: 'admin' | 'coach' | 'athlete' | string
  must_change_password: boolean | null
  created_at: string | null
  updated_at: string | null
}

interface UseAuthReturn {
  user: User | null
  session: Session | null
  profile: ProfileRow | null
  role: string | null
  loading: boolean
  profileLoading: boolean
  refreshProfile: () => Promise<void>
  signOut: () => Promise<void>
  forceRefresh: () => Promise<void>
  silentRefresh: () => Promise<void>
}

export function useAuth(): UseAuthReturn {
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current

  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<ProfileRow | null>(null)

  const [authInitialized, setAuthInitialized] = useState(false)
  const [profileLoading, setProfileLoading] = useState(false)

  const lastProfileFor = useRef<string | null>(null)
  const mounted = useRef(true)
  const currentUserIdRef = useRef<string | null>(null)
  const loadingWatchdog = useRef<ReturnType<typeof setTimeout> | null>(null)

  const PROFILE_CACHE_KEY = 'csroma_profile_cache'
  const PROFILE_CACHE_DURATION = 5 * 60 * 1000

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const loadProfileFromCache = useCallback((userId: string): ProfileRow | null => {
    try {
      const cached = sessionStorage.getItem(PROFILE_CACHE_KEY)
      if (!cached) return null

      const { data, timestamp, userId: cachedUserId } = JSON.parse(cached)
      if (cachedUserId !== userId) return null
      if (Date.now() - timestamp > PROFILE_CACHE_DURATION) return null
      return data as ProfileRow
    } catch {
      return null
    }
  }, [])

  const saveProfileToCache = useCallback((userId: string, profileData: ProfileRow) => {
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

      if (!skipCache && lastProfileFor.current === uid) {
        console.log('[useAuth] Skipping duplicate profile load for', uid)
        return
      }

      if (!skipCache) {
        const cachedProfile = loadProfileFromCache(uid)
        if (cachedProfile) {
          console.log('[useAuth] Profile loaded from cache for', uid)
          setProfile(cachedProfile)
          lastProfileFor.current = uid
          return
        }
      }

      lastProfileFor.current = uid
      setProfileLoading(true)

      console.log('[useAuth] Loading profile from database for', uid)

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', uid)
          .single()

        if (!mounted.current) return

        if (error) {
          console.warn('[useAuth] Profile load error', error)

          const isAuthError =
            error.message?.includes('JWT') ||
            error.message?.includes('token') ||
            error.code === 'PGRST301'

          if (isAuthError) {
            console.warn('[useAuth] Auth error, refreshing session...')
            try {
              const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession()
              if (!refreshError && refreshData.session) {
                console.log('[useAuth] Session refreshed, retrying profile load...')
                lastProfileFor.current = null
                const { data: retryData, error: retryError } = await supabase
                  .from('profiles')
                  .select('*')
                  .eq('id', uid)
                  .single()

                if (!retryError && retryData && mounted.current) {
                  console.log('[useAuth] Profile loaded after session refresh')
                  setProfile(retryData as ProfileRow)
                  saveProfileToCache(uid, retryData as ProfileRow)
                  return
                }
              }
            } catch (refreshErr) {
              console.error('[useAuth] Session refresh failed:', refreshErr)
            }
          }

          setProfile(null)
          return
        }

        console.log('[useAuth] Profile loaded successfully from database')
        setProfile(data as ProfileRow)
        saveProfileToCache(uid, data as ProfileRow)
      } finally {
        if (mounted.current) {
          setProfileLoading(false)
        }
      }
    },
    [supabase, loadProfileFromCache, saveProfileToCache]
  )

  const role = useMemo(() => {
    const raw =
      profile?.role ??
      (user as any)?.app_metadata?.role ??
      (user as any)?.user_metadata?.role ??
      null
    if (raw == null) return null
    return String(raw).trim().toLowerCase()
  }, [profile?.role, user])

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
          if (nextUserId && !profile) {
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
  }, [loadProfile, profile, supabase])

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
    role,
    loading: !authInitialized,
    profileLoading,
    refreshProfile,
    signOut,
    forceRefresh,
    silentRefresh,
  }
}
