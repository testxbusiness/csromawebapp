import { NextRequest, NextResponse } from 'next/server'

import { createAdminClient, createClient } from '@/lib/supabase/server'
import { relationshipUpdateSchema } from '@/lib/validation/relationships'
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

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const supabase = await createClient()
    const actor = await requireRelationshipManager(supabase)
    const { id } = await context.params
    const parsed = relationshipUpdateSchema.safeParse({
      ...(await request.json().catch(() => null)),
      id,
    })
    if (!parsed.success) return NextResponse.json({ error: 'Dati relazione non validi' }, { status: 400 })

    const { id: relationshipId, verified, ...payload } = parsed.data
    const adminClient = createAdminClient()
    const { data: existing, error: existingError } = await adminClient
      .from('profile_relationships')
      .select('id')
      .eq('id', relationshipId)
      .maybeSingle()
    if (existingError) return NextResponse.json({ error: 'Impossibile verificare la relazione' }, { status: 500 })
    if (!existing) return NextResponse.json({ error: 'Relazione non trovata' }, { status: 404 })

    const update: Record<string, unknown> = { ...payload }
    if (verified !== undefined) {
      update.verified_by_auth_user_id = verified ? actor.authUserId : null
      update.verified_at = verified ? new Date().toISOString() : null
    }
    if (Object.keys(update).length === 0) return NextResponse.json({ error: 'Nessuna modifica richiesta' }, { status: 400 })

    const { data, error } = await adminClient
      .from('profile_relationships')
      .update(update)
      .eq('id', relationshipId)
      .select(relationshipColumns)
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ relationship: data })
  } catch (error) {
    if (error instanceof AccountContextError) return NextResponse.json({ error: error.message }, { status: error.status })
    console.error('Errore API modifica relazione:', error)
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const supabase = await createClient()
    await requireRelationshipManager(supabase)
    const { id } = await context.params
    const adminClient = createAdminClient()
    const { data, error } = await adminClient
      .from('profile_relationships')
      .update({ status: 'revoked', valid_until: new Date().toISOString().slice(0, 10) })
      .eq('id', id)
      .select(relationshipColumns)
      .maybeSingle()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    if (!data) return NextResponse.json({ error: 'Relazione non trovata' }, { status: 404 })
    return NextResponse.json({ relationship: data })
  } catch (error) {
    if (error instanceof AccountContextError) return NextResponse.json({ error: error.message }, { status: error.status })
    console.error('Errore API revoca relazione:', error)
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 })
  }
}
