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
  // altri campi se servono
}

interface UseAuthReturn {
  user: User | null
  session: Session | null
  profile: ProfileRow | null
  role: string | null
  loading: boolean        // loading “interno”
  authReady: boolean      // ★ MODIFICATO: nuovo flag per la UI
  refreshProfile: () => Promise<void>
  forceRefresh: () => Promise<void>
  silentRefresh: () => Promise<void>
  signOut: () => Promise<void>
}

export function useAuth(): UseAuthReturn {
  // client supabase stabile
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current

  // stato
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<ProfileRow | null>(null)

  const [loading, setLoading] = useState(true)
  // ★ MODIFICATO:
  // authReady = abbiamo fatto almeno 1 bootstrap completo (session letta + profilo tentato)
  const [authReady, setAuthReady] = useState(false)

  // refs di controllo
  const lastProfileFor = useRef<string | null>(null)
  const mounted = useRef(true)
  const currentUserIdRef = useRef<string | null>(null)
  const loadingWatchdog = useRef<ReturnType<typeof setTimeout> | null>(null)

  // mount/unmount guard
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  // ruolo normalizzato
  const role = useMemo(() => {
    const raw =
      profile?.role ??
      (user as any)?.app_metadata?.role ??
      (user as any)?.user_metadata?.role ??
      null
    if (raw == null) return null
    return String(raw).trim().toLowerCase()
  }, [profile?.role, user])

  // carica profilo (con lock contro loop)
  const loadProfile = useCallback(
    async (uid: string) => {
      if (!uid) {
        setProfile(null)
        return
      }

      if (lastProfileFor.current === uid && profile) {
        return
      }
      lastProfileFor.current = uid

      // eslint-disable-next-line no-console
      console.log('[useAuth] loadProfile started for:', uid)

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', uid)
        .maybeSingle() // ★ MODIFICATO: era .single(); ora .maybeSingle() per non esplodere se 0 righe

      if (!mounted.current) return

      if (error) {
        console.warn('[useAuth] profiles select error', error)
        setProfile(null)
      } else {
        console.log(
          '[useAuth] loadProfile completed for:',
          uid,
          data ? 'success' : 'null'
        )
        setProfile(data as ProfileRow ?? null)
      }
    },
    [profile, supabase]
  )

  const refreshProfile = useCallback(async () => {
    const uid = currentUserIdRef.current
    if (!uid) return
    lastProfileFor.current = null
    await loadProfile(uid)
  }, [loadProfile])

  // Forza refresh esplicito (usato quando vuoi rifare tutto manualmente)
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
      currentUserIdRef.current = uid ?? null

      if (uid) {
        lastProfileFor.current = null
        await loadProfile(uid)
      }
    } finally {
      if (loadingWatchdog.current) {
        clearTimeout(loadingWatchdog.current)
        loadingWatchdog.current = null
      }
      if (mounted.current) setLoading(false)
      if (mounted.current) setAuthReady(true) // ★ MODIFICATO
    }
  }, [loadProfile, supabase])

  // Refresh silenzioso (token refresh durante la vita del tab,
  // non tocca loading = true perché non vogliamo flashare skeleton)
  const silentRefresh = useCallback(async () => {
    try {
      const { data } = await supabase.auth.getSession()
      if (!mounted.current) return
      setSession(data.session ?? null)
      setUser(data.session?.user ?? null)

      const uid = data.session?.user?.id
      currentUserIdRef.current = uid ?? null
      if (uid) {
        // non resetto loading qui, ma aggiorno il profilo se manca
        if (!profile) {
          lastProfileFor.current = null
          await loadProfile(uid)
        }
      }
    } catch (e) {
      console.warn('[useAuth] silentRefresh error', e)
    } finally {
      if (mounted.current) setAuthReady(true) // ★ MODIFICATO
    }
  }, [loadProfile, profile, supabase])

  // BOOTSTRAP iniziale + subscribe onAuthStateChange
  useEffect(() => {
    let unsub: (() => void) | null = null

    const init = async () => {
      setLoading(true)

      // watchdog anti-deadlock
      if (loadingWatchdog.current) clearTimeout(loadingWatchdog.current)
      loadingWatchdog.current = setTimeout(() => {
        if (mounted.current) setLoading(false)
        if (mounted.current) setAuthReady(true)
      }, 5000)

      try {
        // 1. getSession iniziale
        const { data, error } = await supabase.auth.getSession()
        if (!mounted.current) return
        if (error) {
          console.error('[useAuth] getSession error', error)
        }

        const initialSession = data.session ?? null
        const initialUser = data.session?.user ?? null
        setSession(initialSession)
        setUser(initialUser)

        const uid = initialUser?.id ?? null
        currentUserIdRef.current = uid ?? null

        // 2. carica profilo SE c'è utente
        if (uid) {
          await loadProfile(uid).catch(() => {})
        } else {
          setProfile(null)
        }

        // 3. subscribe ai cambi di auth
        const { data: sub } = supabase.auth.onAuthStateChange(
          async (event, _session) => {
            if (!mounted.current) return

            const prevUserId = currentUserIdRef.current
            const nextUserId = _session?.user?.id ?? null
            const sameUser =
              !!(prevUserId && nextUserId && prevUserId === nextUserId)

            const isRefresh =
              event === 'TOKEN_REFRESHED' || event === 'TOKEN_REFRESH'

            // Aggiorna session/user sempre
            setSession(_session ?? null)
            setUser(_session?.user ?? null)
            currentUserIdRef.current = nextUserId

            if (isRefresh && sameUser) {
              // stesso utente → refresh silenzioso
              if (nextUserId && !profile) {
                lastProfileFor.current = null
                await loadProfile(nextUserId).catch(() => {})
              }
              // ★ MODIFICATO:
              // qui prima non garantivi mai setAuthReady(true)
              if (mounted.current) setAuthReady(true)
              return
            }

            // utente cambiato / signed_in / signed_out
            if (!nextUserId) {
              // logout
              setProfile(null)
              lastProfileFor.current = null
              if (mounted.current) {
                setLoading(false)
                setAuthReady(true)
              }
              return
            }

            // nuovo utente o cambio
            lastProfileFor.current = null
            await loadProfile(nextUserId).catch(() => {})

            if (mounted.current) {
              setLoading(false)
              setAuthReady(true) // ★ MODIFICATO
            }
          }
        )

        unsub = () => {
          sub.subscription.unsubscribe()
        }
      } finally {
        // fine init
        if (loadingWatchdog.current) {
          clearTimeout(loadingWatchdog.current)
          loadingWatchdog.current = null
        }
        if (mounted.current) {
          setLoading(false)
          setAuthReady(true) // ★ MODIFICATO
        }
      }
    }

    init().catch((err) => {
      console.error('[useAuth] init error', err)
      if (mounted.current) {
        setLoading(false)
        setAuthReady(true) // ★ MODIFICATO
      }
    })

    return () => {
      if (unsub) unsub()
    }
  }, [loadProfile, supabase])

  // sync al ritorno sul tab / focus
  useEffect(() => {
    let isSubscribed = true
    let t: ReturnType<typeof setTimeout> | null = null

    const onVisible = () => {
      // evitiamo spam durante passaggi rapidi di tab
      if (!isSubscribed) return
      if (document.visibilityState !== 'visible') return
      if (t) clearTimeout(t)

      // ritarda leggermente per evitare di fare mille fetch quando l'utente fa "cmd+tab cmd+tab"
      t = setTimeout(async () => {
        if (!isSubscribed || document.visibilityState !== 'visible') return
        try {
          // qui facciamo silentRefresh, non vogliamo rimettere skeleton
          await silentRefresh()
        } catch (e) {
          console.warn('[useAuth] visibility refresh error', e)
        }
      }, 500)
    }

    window.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)

    return () => {
      isSubscribed = false
      if (t) clearTimeout(t)
      window.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [silentRefresh])

  // logout
  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setUser(null)
    setSession(null)
    setProfile(null)
    lastProfileFor.current = null
    currentUserIdRef.current = null
    if (mounted.current) {
      setLoading(false)
      setAuthReady(true) // ★ MODIFICATO: anche da logged-out l'app è “ready”
    }
  }, [supabase])

  return {
    user,
    session,
    profile,
    role,
    loading,      // interno / diagnostica
    authReady,    // ★ usa QUESTO nel layout per decidere se mostrare skeleton
    refreshProfile,
    forceRefresh,
    silentRefresh,
    signOut,
  }
}
