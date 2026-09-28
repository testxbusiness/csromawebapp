import type { AccountContext } from '@/server/auth/require-account-context'
import type { SubjectPermissions } from '@/server/auth/require-subject-profile'
import type { AthleteProfileContract, MedicalStatus } from '@/types/athlete-profile'

type RawProfile = {
  id: string
  first_name: string
  last_name: string
  email: string | null
  phone?: string | null
  birth_date?: string | null
}

type RawAthleteProfile = {
  profile_id: string
  membership_number?: string | null
  medical_certificate_expiry?: string | null
}

type RawMembership = { id: string; team_id: string; jersey_number: number | null }
type RawTeam = { id: string; name: string; code: string; activity_id: string }
type RawActivity = { id: string; name: string }
type RawDocument = { id: string; title: string; status: string; file_name?: string | null; created_at?: string | null }

function medicalStatus(expiry: string | null, now: Date): MedicalStatus {
  if (!expiry) return 'missing'
  const today = new Date(`${now.toISOString().slice(0, 10)}T00:00:00Z`)
  const expiryDate = new Date(`${expiry}T00:00:00Z`)
  if (expiryDate < today) return 'expired'
  const expiringAt = new Date(today)
  expiringAt.setUTCDate(expiringAt.getUTCDate() + 30)
  return expiryDate <= expiringAt ? 'expiring' : 'valid'
}

export type AthleteProfileBuildInput = {
  account: AccountContext
  subject: { profileId: string; delegated: boolean; permissions: SubjectPermissions }
  profile: RawProfile
  athleteProfile: RawAthleteProfile | null
  memberships: RawMembership[]
  teams: Map<string, RawTeam>
  activities: Map<string, RawActivity>
  documents?: RawDocument[]
  now?: Date
}

export function buildAthleteProfileContract(input: AthleteProfileBuildInput): AthleteProfileContract {
  const { account, subject, profile, athleteProfile } = input
  const canViewMedicalStatus = subject.permissions.view_medical_status
  const expiry = athleteProfile?.medical_certificate_expiry ?? null
  const medical: AthleteProfileContract['athlete']['medical'] = canViewMedicalStatus
    ? {
        status: medicalStatus(expiry, input.now ?? new Date()),
        // A delegated relationship grants the medical status, not the detailed date.
        expires_at: subject.delegated ? null : expiry,
      }
    : { status: 'hidden', expires_at: null }

  return {
    account: {
      status: account.accountStatus,
      roles: account.roles,
      must_change_password: account.mustChangePassword,
    },
    subject: {
      id: subject.profileId,
      first_name: profile.first_name,
      last_name: profile.last_name,
      email: profile.email,
      phone: profile.phone ?? null,
      birth_date: profile.birth_date ?? null,
      delegated: subject.delegated,
    },
    athlete: {
      membership_number: athleteProfile?.membership_number ?? null,
      medical,
      documents: {
        can_view: subject.permissions.view_documents,
        can_sign: subject.permissions.sign_documents,
        items: subject.permissions.view_documents
          ? (input.documents ?? []).map((document) => ({
              id: document.id,
              title: document.title,
              status: document.status,
              file_name: document.file_name ?? null,
              created_at: document.created_at ?? null,
            }))
          : [],
      },
    },
    permissions: {
      view_medical_status: subject.permissions.view_medical_status,
      view_documents: subject.permissions.view_documents,
      sign_documents: subject.permissions.sign_documents,
    },
    memberships: input.memberships.flatMap((membership) => {
      const team = input.teams.get(membership.team_id)
      if (!team) return []
      const activity = input.activities.get(team.activity_id)
      if (!activity) return []
      return [{
        id: membership.id,
        jersey_number: membership.jersey_number,
        team: {
          id: team.id,
          name: team.name,
          code: team.code,
          activity: { id: activity.id, name: activity.name },
        },
      }]
    }),
  }
}
