'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'

interface UseAuthReturn {
  user: User | null
  session: Session | null
  profile: any
  loading: boolean
  signOut: () => Promise<void>
}

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const supabase = useMemo(() => createClient(), [])
  const lastProfileFor = useRef<string | null>(null)

  useEffect(() => {
    let isMounted = true
    
    const getInitialSession = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        
        if (!isMounted) return
        
        if (sessionError) {
          console.error('Error getting session:', sessionError.message || sessionError.code || 'Unknown error')
          setSession(null)
          setUser(null)
          setProfile(null)
          setLoading(false)
          return
        }
        
        // Sblocca immediatamente l'UI con la sessione
        setSession(session)
        setUser(session?.user ?? null)
        setLoading(false) // UI libera qui!
        
        // Carica il profilo in background (se c'è sessione)
        if (session?.user) {
          loadProfile(session.user.id)
        }
      } catch (error) {
        if (!isMounted) return
        console.error('Unexpected error in getInitialSession:', error)
        setLoading(false)
      }
    }

    const loadProfile = async (userId: string) => {
      // Evita richieste duplicate per lo stesso userId
      if (lastProfileFor.current === userId) return
      lastProfileFor.current = userId
      
      try {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select(`
            id,
            first_name,
            last_name,
            role,
            email,
            phone,
            birth_date,
            athlete_profiles(membership_number, medical_certificate_expiry, personal_notes),
            coach_profiles(level, specialization, started_on)
          `)
          .eq('id', userId)
          .maybeSingle()

        if (!isMounted) return

        if (profileError) {
          // Log dettagliato per capire il vero errore
          console.error('Error fetching profile:', {
            message: profileError?.message,
            code: profileError?.code,
            details: profileError?.details,
            hint: profileError?.hint,
            fullError: profileError
          })
          lastProfileFor.current = null // Reset per permettere retry
        } else {
          const extended = profile
            ? {
                ...profile,
                phone: profile.phone ?? null,
                birth_date: profile.birth_date ?? null,
                membership_number: profile.athlete_profiles?.membership_number ?? null,
                medical_certificate_expiry: profile.athlete_profiles?.medical_certificate_expiry ?? null,
                athlete_profile: profile.athlete_profiles,
                coach_profile: profile.coach_profiles,
              }
            : null

          setProfile(extended) // può essere null se il profilo non esiste
        }
      } catch (error) {
        if (!isMounted) return
        console.error('Unexpected error loading profile:', error)
        lastProfileFor.current = null // Reset per permettere retry
      }
    }

    getInitialSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return
      
      try {
        setSession(session)
        setUser(session?.user ?? null)
        
        if (session?.user) {
          loadProfile(session.user.id)
        } else {
          setProfile(null)
          lastProfileFor.current = null // Reset su logout
        }
      } catch (error) {
        if (!isMounted) return
        console.error('Unexpected error in auth state change:', error)
      }
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [supabase]) // Aggiunto supabase come dependency per sicurezza

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  return {
    user,
    session,
    profile,
    loading,
    signOut,
  }
}
