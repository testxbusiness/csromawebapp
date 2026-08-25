import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

export type AccountLifecycleEventType =
  | 'profile_created'
  | 'account_provisioning_started'
  | 'account_created'
  | 'account_invited'
  | 'account_activated'
  | 'account_suspended'
  | 'account_reactivated'
  | 'account_disabled'
  | 'account_deleted'
  | 'account_role_granted'
  | 'account_role_revoked'
  | 'mapping_verified'
  | 'provisioning_failed'
  | 'repair_required'

export type AccountLifecycleAuditInput = {
  eventType: AccountLifecycleEventType
  subjectProfileId?: string | null
  subjectAuthUserId?: string | null
  performedByAuthUserId?: string | null
  performedByProfileId?: string | null
  performedByEmail?: string | null
  performedByFirstName?: string | null
  performedByLastName?: string | null
  details?: Record<string, unknown>
}

export async function getAccountActorSnapshot(
  adminClient: SupabaseClient,
  actorProfileId: string
) {
  const { data } = await adminClient
    .from('profiles')
    .select('email, first_name, last_name')
    .eq('id', actorProfileId)
    .maybeSingle()

  return {
    performedByEmail: data?.email ?? null,
    performedByFirstName: data?.first_name ?? null,
    performedByLastName: data?.last_name ?? null,
  }
}

export async function recordAccountLifecycleAudit(
  adminClient: SupabaseClient,
  input: AccountLifecycleAuditInput
): Promise<void> {
  const { error } = await adminClient
    .from('account_lifecycle_audit')
    .insert({
      event_type: input.eventType,
      subject_profile_id: input.subjectProfileId ?? null,
      subject_auth_user_id: input.subjectAuthUserId ?? null,
      performed_by_auth_user_id: input.performedByAuthUserId ?? null,
      performed_by_profile_id: input.performedByProfileId ?? null,
      performed_by_email: input.performedByEmail ?? null,
      performed_by_first_name: input.performedByFirstName ?? null,
      performed_by_last_name: input.performedByLastName ?? null,
      details: input.details ?? {},
    })

  if (error) {
    throw new Error(`Impossibile registrare audit ciclo di vita: ${error.message}`)
  }
}
