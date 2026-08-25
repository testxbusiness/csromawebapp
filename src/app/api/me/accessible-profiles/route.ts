import { NextResponse } from 'next/server'

import { createAdminClient, createClient } from '@/lib/supabase/server'
import { AccountContextError, requireAccountContext } from '@/server/auth/require-account-context'

type RelationshipRow = {
  id: string
  source_profile_id: string
  target_profile_id: string
  relationship_type: string
  status: string
  valid_from: string
  valid_until: string | null
  can_view_schedule: boolean
  can_confirm_attendance: boolean
  can_view_payments: boolean
  can_view_medical_status: boolean
  can_view_documents: boolean
  can_sign_documents: boolean
  can_receive_messages: boolean
  is_primary_contact: boolean
  is_billing_contact: boolean
  is_emergency_contact: boolean
  verified_at: string | null
}

function isMinor(birthDate: string | null, today: Date) {
  if (!birthDate) return true
  const birthday = new Date(`${birthDate}T00:00:00Z`)
  const eighteenthBirthday = new Date(birthday)
  eighteenthBirthday.setUTCFullYear(eighteenthBirthday.getUTCFullYear() + 18)
  return today < eighteenthBirthday
}

export async function GET() {
  try {
    const supabase = await createClient()
    const account = await requireAccountContext(supabase)
    const adminClient = createAdminClient()
    const today = new Date()

    const [{ data: relationships, error: relationshipsError }, { data: profiles, error: profilesError }, { data: overrides, error: overridesError }] = await Promise.all([
      adminClient.from('profile_relationships').select('*').eq('source_profile_id', account.ownerProfileId).eq('status', 'active').lte('valid_from', today.toISOString().slice(0, 10)).or(`valid_until.is.null,valid_until.gte.${today.toISOString().slice(0, 10)}`),
      adminClient.from('profiles').select('id, first_name, last_name, email, birth_date').neq('id', account.ownerProfileId),
      adminClient.from('profile_age_overrides').select('profile_id, treat_as_minor').eq('active', true),
    ])

    if (relationshipsError || profilesError || overridesError) {
      console.error('Errore caricamento profili accessibili:', relationshipsError || profilesError || overridesError)
      return NextResponse.json({ error: 'Impossibile caricare i profili accessibili' }, { status: 500 })
    }

    const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]))
    const overrideByProfile = new Map((overrides ?? []).map((override) => [override.profile_id, override.treat_as_minor]))
    const accessible = (relationships as RelationshipRow[] ?? []).filter((relationship) => {
      if (relationship.relationship_type === 'delegate' && relationship.verified_at) return true
      const profile = profileById.get(relationship.target_profile_id)
      const targetIsMinor = overrideByProfile.has(relationship.target_profile_id)
        ? overrideByProfile.get(relationship.target_profile_id) === true
        : isMinor(profile?.birth_date ?? null, today)
      return targetIsMinor && ['parent', 'guardian', 'caregiver', 'delegate'].includes(relationship.relationship_type)
    }).map((relationship) => {
      const profile = profileById.get(relationship.target_profile_id)
      return {
        profile: profile ? {
          id: profile.id,
          first_name: profile.first_name,
          last_name: profile.last_name,
          email: profile.email,
        } : null,
        relationship: {
          id: relationship.id,
          type: relationship.relationship_type,
          verified_at: relationship.verified_at,
          permissions: {
            view_schedule: relationship.can_view_schedule,
            confirm_attendance: relationship.can_confirm_attendance,
            view_payments: relationship.can_view_payments,
            view_medical_status: relationship.can_view_medical_status,
            view_documents: relationship.can_view_documents,
            sign_documents: relationship.can_sign_documents,
            receive_messages: relationship.can_receive_messages,
          },
        },
      }
    }).filter((item) => item.profile !== null)

    return NextResponse.json({ profiles: accessible })
  } catch (error) {
    if (error instanceof AccountContextError) return NextResponse.json({ error: error.message }, { status: error.status })
    console.error('Errore API profili accessibili:', error)
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 })
  }
}
