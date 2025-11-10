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
}

export function useAuth(): UseAuthReturn {
  // Client Supabase stabile con useRef
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current

  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<ProfileRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [profileLoading, setProfileLoading] = useState(false)

  // Evita refetch multipli dello stesso profilo
  const lastProfileFor = useRef<string | null>(null)
  const mounted = useRef(true)
  const currentUserIdRef = useRef<string | null>(null)
  const loadingWatchdog = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  // Deriva un ruolo “risolto” con fallback al JWT, normalizzato
  const role = useMemo(() => {
    const raw =
      profile?.role ??
      (user as any)?.app_metadata?.role ??
      (user as any)?.user_metadata?.role ??
      null
    if (raw == null) return null
    return String(raw).trim().toLowerCase()
  }, [profile?.role, user])

  // Debug opzionale: abilita su Vercel con NEXT_PUBLIC_DEBUG_ROLE=1
  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_DEBUG_ROLE) return
    // Non loggare dati sensibili; giusto due info utili di debug
    // eslint-disable-next-line no-console
    console.log('[useAuth] role debug', {
      roleFromProfile: profile?.role,
      roleFromAppMeta: (user as any)?.app_metadata?.role,
      roleFromUserMeta: (user as any)?.user_metadata?.role,
      resolvedRole: role,
    })
  }, [profile?.role, user, role])

  const loadProfile = useCallback(async (uid: string) => {
    if (!uid) return
    // Evita richieste duplicate; lasciamo che chi forza il reload azzeri il marker
    if (lastProfileFor.current === uid) {
      // eslint-disable-next-line no-console
      console.log('[useAuth] loadProfile: skipping duplicate for', uid)
      return
    }
    lastProfileFor.current = uid

    // Debug timing
    console.log('[useAuth] loadProfile started for:', uid)

    // Inizia caricamento profilo
    setProfileLoading(true)

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', uid)
        .single()

      if (!mounted.current) return
      if (error) {
        console.warn('[useAuth] profiles select error', error)

        // Se errore 401/403, il token potrebbe essere scaduto - forza refresh della sessione
        const isAuthError = error.message?.includes('JWT') ||
                           error.message?.includes('token') ||
                           error.message?.includes('unauthorized') ||
                           error.code === 'PGRST301' || // PostgREST JWT expired
                           error.code === '401' ||
                           error.code === '403'

        if (isAuthError) {
          console.warn('[useAuth] Auth error detected, attempting session refresh...')
          try {
            const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession()
            if (!refreshError && refreshData.session) {
              console.log('[useAuth] Session refreshed successfully, retrying profile load...')
              // Retry profile load con il nuovo token
              lastProfileFor.current = null
              const { data: retryData, error: retryError } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', uid)
                .single()

              if (!retryError && retryData && mounted.current) {
                console.log('[useAuth] Profile loaded successfully after session refresh')
                setProfile(retryData as ProfileRow)
                return
              }
            }
          } catch (refreshErr) {
            console.error('[useAuth] Failed to refresh session:', refreshErr)
          }
        }

        setProfile(null)
        return
      }

      console.log('[useAuth] loadProfile completed for:', uid, data ? 'success' : 'error')
      setProfile(data as ProfileRow)
    } finally {
      // Termina caricamento profilo sempre, anche in caso di errore
      if (mounted.current) {
        setProfileLoading(false)
      }
    }
  }, [])

  const refreshProfile = useCallback(async () => {
    const uid = currentUserIdRef.current
    if (!uid) return
    lastProfileFor.current = null
    await loadProfile(uid)
  }, [loadProfile])

  // Aggiorna forzando sessione e profilo con loading esplicito
  const forceRefresh = useCallback(async () => {
    setLoading(true)
    if (loadingWatchdog.current) clearTimeout(loadingWatchdog.current)
    loadingWatchdog.current = setTimeout(() => {
      if (mounted.current) setLoading(false)
    }, 5000)
    try {
      const { data } = await supabase.auth.getSession()
      if (!mounted.current) return
      setSession(data.session ?? null)
      setUser(data.session?.user ?? null)
      const uid = data.session?.user?.id
      if (uid) {
        lastProfileFor.current = null
        await loadProfile(uid)
      }
    } finally {
      if (loadingWatchdog.current) { clearTimeout(loadingWatchdog.current); loadingWatchdog.current = null }
      if (mounted.current) setLoading(false)
    }
  }, [loadProfile])

  // Aggiorna silenziosamente in background senza toccare loading
  const silentRefresh = useCallback(async () => {
    try {
      const { data } = await supabase.auth.getSession()
      if (!mounted.current) return
      setSession(data.session ?? null)
      setUser(data.session?.user ?? null)
      const uid = data.session?.user?.id
      if (uid) {
        // ricarica direttamente il profilo senza passare da loadProfile per non alterare lastProfileFor
        const { data: p } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', uid)
          .single()
        if (mounted.current && p) setProfile(p as ProfileRow)
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[useAuth] silentRefresh error', e)
    }
  }, [])

  useEffect(() => {
    let unsub: (() => void) | null = null

    const init = async () => {
      // Watchdog di sicurezza: sblocca dopo 5 secondi max
      if (loadingWatchdog.current) clearTimeout(loadingWatchdog.current)
      loadingWatchdog.current = setTimeout(() => {
        if (mounted.current) setLoading(false)
      }, 5000)

      try {
        // 1) sessione iniziale - aspetta il caricamento completo del profilo
        const { data, error } = await supabase.auth.getSession()
        if (!mounted.current) return
        if (error) {
          // eslint-disable-next-line no-console
          console.error('[useAuth] getSession error', error)
        }
        setSession(data.session ?? null)
        setUser(data.session?.user ?? null)
        currentUserIdRef.current = data.session?.user?.id ?? null

        if (data.session?.user?.id) {
          // Aspetta il caricamento del profilo per evitare il flash del fallback
          setProfileLoading(true)
          await loadProfile(data.session.user.id)
        } else {
          setProfile(null)
          setProfileLoading(false)
        }
      } finally {
        // Pulisci il watchdog e sblocca loading
        if (loadingWatchdog.current) {
          clearTimeout(loadingWatchdog.current)
          loadingWatchdog.current = null
        }
        if (mounted.current) setLoading(false)
      }

      // 2) subscribe ai cambi di auth
      const { data: sub } = supabase.auth.onAuthStateChange(async (event, _session) => {
        if (!mounted.current) return
        const prevUserId = currentUserIdRef.current
        const nextUserId = _session?.user?.id ?? null
        const sameUser = !!(prevUserId && nextUserId && prevUserId === nextUserId)
        const isRefresh = event === 'TOKEN_REFRESHED' || event === 'TOKEN_REFRESH'

        // Aggiorna sempre sessione/utente e traccia user corrente
        setSession(_session ?? null)
        setUser(_session?.user ?? null)
        currentUserIdRef.current = nextUserId

        // Gestione silenziosa dei token refresh per lo stesso utente
        if (isRefresh && sameUser) {
          if (nextUserId && !profile) {
            // Solo se manca il profilo fai un refetch silenzioso
            await loadProfile(nextUserId)
          }
          return
        }

        // Per cambi utente o SIGNED_IN/USER_UPDATED, gestisci loading esplicito
        setLoading(true)
        if (loadingWatchdog.current) clearTimeout(loadingWatchdog.current)
        loadingWatchdog.current = setTimeout(() => {
          if (mounted.current) setLoading(false)
        }, 5000)

        try {
          if (nextUserId) {
            lastProfileFor.current = null
            await loadProfile(nextUserId)
          } else {
            setProfile(null)
          }
        } finally {
          if (loadingWatchdog.current) { clearTimeout(loadingWatchdog.current); loadingWatchdog.current = null }
          if (mounted.current) setLoading(false)
        }
      })
      unsub = () => sub.subscription.unsubscribe()
    }

    init().catch((e) => {
      if (!mounted.current) return
      // eslint-disable-next-line no-console
      console.error('[useAuth] init unexpected error', e)
      setLoading(false)
    })

    return () => {
      unsub?.()
      if (loadingWatchdog.current) clearTimeout(loadingWatchdog.current)
    }
  }, [loadProfile])

  // Refresh session/profile quando la tab torna visibile (debounced)
  const lastRefreshTimeRef = useRef<number>(0)
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | null = null
    let isSubscribed = true
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      if (t) clearTimeout(t)
      t = setTimeout(async () => {
        if (!isSubscribed || document.visibilityState !== 'visible') return

        // Ridotta soglia a 10 secondi per refresh più reattivo
        const now = Date.now()
        const timeSinceLastRefresh = now - lastRefreshTimeRef.current
        const shouldRefresh = !profile || timeSinceLastRefresh > 10000

        if (shouldRefresh) {
          try {
            // Forza refresh della sessione da Supabase per validare il token
            const { data, error } = await supabase.auth.refreshSession()
            if (!isSubscribed) return

            if (error) {
              console.warn('[useAuth] session refresh failed on visibility change:', error)
              // Se il refresh fallisce, prova a ottenere la sessione esistente
              const { data: fallbackData } = await supabase.auth.getSession()
              setSession(fallbackData.session ?? null)
              setUser(fallbackData.session?.user ?? null)
            } else {
              setSession(data.session ?? null)
              setUser(data.session?.user ?? null)
            }

            const uid = data?.session?.user?.id
            if (uid) {
              lastProfileFor.current = null
              await loadProfile(uid)
            } else {
              // Nessuna sessione valida, pulisci il profilo
              setProfile(null)
            }
            lastRefreshTimeRef.current = now
          } catch (e) {
            // eslint-disable-next-line no-console
            console.warn('[useAuth] visibility refresh error', e)
          }
        }
      }, 1000) // Debounce di 1 secondo per evitare trigger multipli
    }

    window.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      isSubscribed = false
      if (t) clearTimeout(t)
      window.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [loadProfile, profile])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setUser(null)
    setSession(null)
    setProfile(null)
    lastProfileFor.current = null
    currentUserIdRef.current = null
  }, [])

  return { user, session, profile, role, loading, profileLoading, refreshProfile, signOut, forceRefresh, silentRefresh }
}
