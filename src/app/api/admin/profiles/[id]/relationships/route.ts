import { NextRequest, NextResponse } from 'next/server'

import { createAdminClient, createClient } from '@/lib/supabase/server'
import { relationshipCreateSchema } from '@/lib/validation/relationships'
import { AccountContextError } from '@/server/auth/require-account-context'
import { requireRelationshipManager } from '@/server/auth/require-relationship-manager'

type RouteContext = { params: Promise<{ id: string }> }

const relationshipColumns = [
  'id', 'source_profile_id', 'target_profile_id', 'relationship_type', 'status',
  'valid_from', 'valid_until', 'can_view_schedule', 'can_confirm_attendance',
  'can_view_payments', 'can_view_medical_status', 'can_view_documents',
  'can_sign_documents', 'can_receive_messages', 'is_primary_contact',
  'is_billing_contact', 'is_emergency_contact', 'verified_by_auth_user_id',
  'verified_at', 'created_at', 'updated_at',
].join(', ')

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const supabase = await createClient()
    await requireRelationshipManager(supabase)
    const { id } = await context.params
    const adminClient = createAdminClient()
    const { data, error } = await adminClient
      .from('profile_relationships')
      .select(relationshipColumns)
      .or(`source_profile_id.eq.${id},target_profile_id.eq.${id}`)
      .eq('status', 'active')
      .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: 'Impossibile caricare le relazioni' }, { status: 500 })
    return NextResponse.json({ relationships: data ?? [] })
  } catch (error) {
    if (error instanceof AccountContextError) return NextResponse.json({ error: error.message }, { status: error.status })
    console.error('Errore API lista relazioni:', error)
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 })
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const supabase = await createClient()
    const actor = await requireRelationshipManager(supabase)
    const { id } = await context.params
    const parsed = relationshipCreateSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: 'Dati relazione non validi' }, { status: 400 })
    const { verified, ...relationship } = parsed.data
    if (relationship.source_profile_id !== id && relationship.target_profile_id !== id) {
      return NextResponse.json({ error: 'La relazione non appartiene al profilo indicato' }, { status: 400 })
    }
    if (relationship.source_profile_id === relationship.target_profile_id) {
      return NextResponse.json({ error: 'Una persona non può essere collegata a se stessa' }, { status: 400 })
    }

    const adminClient = createAdminClient()
    const { data: profiles, error: profilesError } = await adminClient
      .from('profiles')
      .select('id')
      .in('id', [relationship.source_profile_id, relationship.target_profile_id])
    if (profilesError) return NextResponse.json({ error: 'Impossibile verificare i profili' }, { status: 500 })
    if ((profiles ?? []).length !== 2) return NextResponse.json({ error: 'Profilo sorgente o target non trovato' }, { status: 404 })

    const { data, error } = await adminClient
      .from('profile_relationships')
      .insert({
        ...relationship,
        valid_from: relationship.valid_from ?? new Date().toISOString().slice(0, 10),
        verified_by_auth_user_id: verified ? actor.authUserId : null,
        verified_at: verified ? new Date().toISOString() : null,
      })
      .select(relationshipColumns)
      .single()

    if (error) {
      console.error('Errore creazione relazione:', error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ relationship: data }, { status: 201 })
  } catch (error) {
    if (error instanceof AccountContextError) return NextResponse.json({ error: error.message }, { status: error.status })
    console.error('Errore API creazione relazione:', error)
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 })
  }
}
