import type { AccountRole, AccountStatus } from '@/server/auth/require-account-context'
import type { SubjectPermissions } from '@/server/auth/require-subject-profile'

export type MedicalStatus = 'hidden' | 'missing' | 'valid' | 'expiring' | 'expired'

export interface AthleteProfileContract {
  account: {
    status: AccountStatus
    roles: AccountRole[]
    must_change_password: boolean
  }
  subject: {
    id: string
    first_name: string
    last_name: string
    email: string | null
    phone: string | null
    birth_date: string | null
    delegated: boolean
  }
  athlete: {
    membership_number: string | null
    medical: {
      status: MedicalStatus
      expires_at: string | null
    }
    documents: {
      can_view: boolean
      can_sign: boolean
      items: Array<{
        id: string
        title: string
        status: string
        file_name: string | null
        created_at: string | null
      }>
    }
  }
  permissions: Pick<SubjectPermissions, 'view_medical_status' | 'view_documents' | 'sign_documents'>
  memberships: Array<{
    id: string
    jersey_number: number | null
    team: {
      id: string
      name: string
      code: string
      activity: { id: string; name: string }
    }
  }>
}
