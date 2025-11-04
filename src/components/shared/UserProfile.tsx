'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { JerseyCard } from '@/components/athlete/JerseyCard'
import { usePush } from '@/hooks/usePush'

interface ProfileData {
  first_name: string
  last_name: string
  phone_number?: string
  date_of_birth?: string
  avatar_url?: string
}

interface UserProfileProps {
  userRole: 'admin' | 'coach' | 'athlete'
}

export default function UserProfile({ userRole }: UserProfileProps) {
  const { user, profile, refreshProfile } = useAuth()
  const isEditable = userRole === 'admin'
  const [profileData, setProfileData] = useState<ProfileData>({
    first_name: '',
    last_name: '',
    phone_number: '',
    date_of_birth: '',
    avatar_url: ''
  })
  const [teamMemberships, setTeamMemberships] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })
  const supabase = createClient()
  const { subscribe, unsubscribe } = usePush()
  const [pushSupported, setPushSupported] = useState<boolean>(false)
  const [pushPermission, setPushPermission] = useState<NotificationPermission>('default')
  const [isSubscribed, setIsSubscribed] = useState<boolean>(false)

  useEffect(() => {
    if (profile) {
      setProfileData({
        first_name: profile.first_name || '',
        last_name: profile.last_name || '',
        phone_number: (profile as any).phone || (profile as any).phone_number || '',
        date_of_birth: profile.date_of_birth || '',
        avatar_url: profile.avatar_url || ''
      })
      loadUserData()
    }
  }, [profile])

  // Push capability check
  useEffect(() => {
    const supported = typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
    setPushSupported(supported)
    if (!supported) return
    setPushPermission(Notification.permission)
    navigator.serviceWorker.getRegistration().then(async (reg) => {
      const sub = await reg?.pushManager.getSubscription()
      setIsSubscribed(!!sub)
    }).catch(() => setIsSubscribed(false))
  }, [])

  const loadUserData = async () => {
    setLoading(true)
    
    if (userRole === 'athlete' && user) {
      // Load team memberships for athletes (avoid PostgREST deep embeds to prevent 400)
      const { data: memberships, error: mErr } = await supabase
        .from('team_members')
        .select('id, team_id, jersey_number')
        .eq('profile_id', user.id)

      if (mErr) {
        console.error('Error loading team memberships:', mErr)
        setTeamMemberships([])
      } else {
        const list = memberships || []
        if (list.length === 0) {
          setTeamMemberships([])
        } else {
          const teamIds = Array.from(new Set(list.map((r:any)=>r.team_id).filter(Boolean)))
          let teams: any[] = []
          let activities: any[] = []
          if (teamIds.length > 0) {
            const { data: tdata } = await supabase
              .from('teams')
              .select('id, name, code, activity_id')
              .in('id', teamIds)
            teams = tdata || []
            const activityIds = Array.from(new Set(teams.map((t:any)=>t.activity_id).filter(Boolean)))
            if (activityIds.length > 0) {
              const { data: adata } = await supabase
                .from('activities')
                .select('id, name')
                .in('id', activityIds)
              activities = adata || []
            }
          }

          const teamMap = new Map(teams.map((t:any)=>[t.id, t]))
          const activityMap = new Map(activities.map((a:any)=>[a.id, a]))

          const composed = list.map((r:any)=>{
            const t = teamMap.get(r.team_id)
            const a = t ? activityMap.get(t.activity_id) : null

            return {
              id: r.id,
              jersey_number: r.jersey_number,
              membership_number: profile?.athlete_profile?.membership_number ?? undefined,
              medical_certificate_expiry: profile?.athlete_profile?.medical_certificate_expiry ?? undefined,
              team: t ? { id: t.id, name: t.name, code: t.code, activity: a ? { name: a.name } : null } : null
            }
          })
          setTeamMemberships(composed)
        }
      }
    }
    
    setLoading(false)
  }

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    try {
      // Update only safe fields known to exist
      const updateData: any = {
        first_name: profileData.first_name,
        last_name: profileData.last_name,
        phone: profileData.phone_number,
        phone_number: profileData.phone_number
      }
      const { error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', user?.id)

      if (error) throw error

      await refreshProfile()
      alert('Profilo aggiornato con successo!')
    } catch (error) {
      console.error('Error updating profile:', error)
      alert('Errore nell\'aggiornamento del profilo')
    }

    setSaving(false)
  }

  const handlePasswordChange = async (e?: React.FormEvent) => {
    e?.preventDefault()
    
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      alert('Le password non coincidono')
      return
    }

    if (passwordData.newPassword.length < 6) {
      alert('La password deve essere di almeno 6 caratteri')
      return
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: passwordData.newPassword
      })

      if (error) throw error

      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      })
      alert('Password cambiata con successo!')
    } catch (error) {
      console.error('Error changing password:', error)
      alert('Errore nel cambio password')
    }
  }

          const jerseyNumber =
            (teamMemberships.find(m => !!m.jersey_number)?.jersey_number ??
            (profile as any)?.athlete_profile?.jersey_number ??
          null);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      // Upload to Supabase Storage
      const fileExt = file.name.split('.').pop()
      const fileName = `${user?.id}-${Math.random()}.${fileExt}`
      const filePath = `avatars/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      // Get public URL
      const { data } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath)

      // Update profile with new avatar URL
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: data.publicUrl })
        .eq('id', user?.id)

      if (updateError) throw updateError

      setProfileData(prev => ({ ...prev, avatar_url: data.publicUrl }))
      await refreshProfile()
    } catch (error) {
      console.error('Error uploading avatar:', error)
      alert('Errore nel caricamento dell\'immagine')
    }
  }

  const handleEnablePush = async () => {
    try {
      await subscribe('Dispositivo personale')
      setPushPermission(Notification.permission)
      setIsSubscribed(true)
      alert('Notifiche push attivate su questo dispositivo')
    } catch (e: any) {
      console.error('Enable push error', e)
      alert(e?.message || 'Impossibile attivare le notifiche push')
    }
  }

  const handleDisablePush = async () => {
    try {
      await unsubscribe()
      setIsSubscribed(false)
      alert('Notifiche push disattivate su questo dispositivo')
    } catch (e) {
      console.error('Disable push error', e)
      alert('Impossibile disattivare le notifiche push')
    }
  }

  if (loading) {
    return (
      <div className="cs-card p-6">
        <div className="cs-skeleton h-6 w-1/3 mb-4"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="cs-card p-4">
            <div className="cs-skeleton h-4 w-1/2 mb-2"></div>
            <div className="cs-skeleton h-4 w-1/3"></div>
          </div>
          <div className="cs-card p-4">
            <div className="cs-skeleton h-4 w-1/2 mb-2"></div>
            <div className="cs-skeleton h-4 w-1/3"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          {/* Profile Information */}
          <div className="cs-card cs-card--primary p-6">
            <h2 className="text-xl font-semibold mb-4">Informazioni Personali</h2>
            
            {/* Avatar Section */}
            <div className="flex items-center space-x-6 mb-6">
              <div className="relative">
                {profileData.avatar_url ? (
                  <img
                    src={profileData.avatar_url}
                    alt="Avatar"
                    className="w-20 h-20 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-full cs-card flex items-center justify-center">
                    <span className="text-secondary text-xl">
                      {profileData.first_name?.charAt(0)}{profileData.last_name?.charAt(0)}
                    </span>
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
              </div>
              <div>
                <h3 className="font-medium">
                  {profileData.first_name} {profileData.last_name}
                </h3>
                <p className="text-sm text-secondary">
                  {profile?.role?.toUpperCase()}
                </p>
                <p className="text-xs text-secondary mt-1">
                  Clicca sull'avatar per cambiare l'immagine
                </p>
              </div>
            </div>

            <form onSubmit={isEditable ? handleProfileUpdate : (e)=>e.preventDefault()} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="cs-field__label">
                    Nome *
                  </label>
                  <input
                    type="text"
                    value={profileData.first_name}
                    onChange={(e) => setProfileData(prev => ({ ...prev, first_name: e.target.value }))}
                    required
                    disabled={!isEditable}
                    className="cs-input"
                  />
                </div>

                <div>
                  <label className="cs-field__label">
                    Cognome *
                  </label>
                  <input
                    type="text"
                    value={profileData.last_name}
                    onChange={(e) => setProfileData(prev => ({ ...prev, last_name: e.target.value }))}
                    required
                    disabled={!isEditable}
                    className="cs-input"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="cs-field__label">
                    Telefono
                  </label>
                  <input
                    type="tel"
                    value={profileData.phone_number}
                    onChange={(e) => setProfileData(prev => ({ ...prev, phone_number: e.target.value }))}
                    disabled={!isEditable}
                    className="cs-input"
                  />
                </div>
              </div>

              <div>
                <label className="cs-field__label">
                  Email
                </label>
                <input
                  type="email"
                  value={user?.email || ''}
                  disabled
                  className="cs-input"
                />
                <p className="text-xs text-secondary mt-1">
                  L'email non può essere modificata da qui
                </p>
              </div>

              {isEditable && (
                <button type="submit" disabled={saving} className="cs-btn cs-btn--primary disabled:opacity-50">
                  {saving ? 'Salvataggio...' : 'Aggiorna Profilo'}
                </button>
              )}
            </form>
          </div>

          {/* Team Memberships (Athletes only) */}
          {userRole === 'athlete' && (
            <div className="cs-card cs-card--primary p-6">
              <h2 className="text-xl font-semibold mb-4">Le Mie Squadre</h2>
              {teamMemberships.length === 0 ? (
                <p className="text-secondary">Non sei iscritto a nessuna squadra</p>
              ) : (
                <div className="space-y-4">
                  {teamMemberships.map((membership) => (
                    <div key={membership.id} className="cs-card p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-medium">{membership.team.name}</h3>
                          <p className="text-sm text-secondary">Codice: {membership.team.code}</p>
                          <p className="text-sm text-secondary">Attività: {membership.team.activity?.name}</p>
                        </div>
                        <div className="text-right text-sm">
                          {membership.jersey_number && (
                            <div>Maglia: #{membership.jersey_number}</div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {userRole === 'athlete' && (
            <div className="cs-card cs-card--primary p-6">
              <h2 className="text-xl font-semibold mb-4">La tua maglia</h2>
            {/* Contenitore responsivo: centrato, dimensione controllata su desktop */}
              <div className="mx-auto w-full max-w-[420px]">
                <JerseyCard
                  number={jerseyNumber ? String(jerseyNumber) : '—'}
                  color="var(--cs-warm)"         // giallo brand
                  outline="var(--cs-accent)"     // blu/viola brand
                  outlineWidth={4}
                  />
              </div>
            </div>
          )}

          {/* Membership & Cert info (from profile) */}
          {userRole === 'athlete' && profile && (
            <div className="cs-card cs-card--primary p-6">
              <h2 className="text-xl font-semibold mb-4">Dati Tesseramento</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-secondary">Numero Tessera</div>
                  <div className="font-medium">{profile.athlete_profile?.membership_number || '—'}</div>
                </div>
                <div>
                  <div className="text-secondary">Scadenza Certificato Medico</div>
                  <div className="font-medium">{profile.athlete_profile?.medical_certificate_expiry ? new Date(profile.athlete_profile.medical_certificate_expiry).toLocaleDateString('it-IT') : '—'}</div>
                </div>
                {profile.athlete_profile?.personal_notes && (
                  <div className="md:col-span-2">
                    <div className="text-secondary">Note</div>
                    <div className="font-medium whitespace-pre-line">{profile.athlete_profile.personal_notes}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Push Notifications */}
          <div className="cs-card cs-card--primary p-6">
            <h2 className="text-xl font-semibold mb-2">Notifiche Push</h2>
            {!pushSupported ? (
              <p className="text-sm text-secondary">Il tuo browser non supporta le notifiche push.</p>
            ) : (
              <div className="flex items-center justify-between">
                <div className="text-sm text-secondary">
                  Stato: {isSubscribed ? 'attive' : 'non attive'}
                  {pushPermission === 'denied' && (
                    <>
                      {' '}
                      <span className="text-[color:var(--cs-danger)]">(permesso negato a livello browser)</span>
                    </>
                  )}
                </div>
                {isSubscribed ? (
                  <button className="cs-btn cs-btn--outline" onClick={handleDisablePush}>Disattiva</button>
                ) : (
                  <button className="cs-btn cs-btn--primary" onClick={handleEnablePush} disabled={pushPermission === 'denied'}>
                    Attiva
                  </button>
                )}
              </div>
            )}
          </div>
            
          {/* Password Change */}
          <div className="cs-card cs-card--primary p-6">
            <h2 className="text-xl font-semibold mb-4">Cambia Password</h2>
            <form className="space-y-4">
              <div>
                <label className="cs-field__label">
                  Nuova Password *
                </label>
                <input
                  type="password"
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                  required
                  minLength={6}
                  className="cs-input"
                />
              </div>

              <div>
                <label className="cs-field__label">
                  Conferma Nuova Password *
                </label>
                <input
                  type="password"
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                  required
                  minLength={6}
                  className="cs-input"
                />
              </div>

              <button type="button" className="cs-btn cs-btn--danger" onClick={() => handlePasswordChange()}>
                Cambia Password
              </button>
            </form>
          </div>
        </div>
      </main>
    </div>
  )
}
