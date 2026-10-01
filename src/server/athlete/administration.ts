import 'server-only'

import type { SubjectAthleteContext } from '@/server/auth/require-subject-profile'
import { getCertificateStatus } from '@/lib/athlete/certificate-status'
import { loadAthleteFeesContract } from '@/server/athlete/fees'
import type { AthleteAdministrationContract } from '@/types/athlete-administration'

type SeasonProfileRow = { enrollment_application_delivered: boolean }
type AthleteProfileRow = { medical_certificate_expiry: string | null }

export type AthleteAdministrationBuildInput = {
  delegated: boolean
  permissions: SubjectAthleteContext['permissions']
  enrollmentApplicationDelivered: boolean | null
  medicalCertificateExpiry: string | null
  fees: AthleteAdministrationContract['fees']
  now?: Date
}

export function buildAthleteAdministrationContract(
  input: AthleteAdministrationBuildInput,
): AthleteAdministrationContract {
  return {
    enrollment_application: input.permissions.view_documents
      ? { delivered: input.enrollmentApplicationDelivered ?? false }
      : null,
    medical_certificate: input.permissions.view_medical_status
      ? {
          status: getCertificateStatus(input.medicalCertificateExpiry, input.now),
          expires_at: input.delegated ? null : input.medicalCertificateExpiry,
        }
      : null,
    fees: input.permissions.view_payments ? input.fees : null,
  }
}

export async function loadAthleteAdministrationContract(
  subject: SubjectAthleteContext,
): Promise<AthleteAdministrationContract> {
  const client = subject.dataClient
  const canViewEnrollmentApplication = subject.permissions.view_documents
  const canViewMedicalCertificate = subject.permissions.view_medical_status
  const canViewFees = subject.permissions.view_payments

  const [seasonProfileResult, athleteProfileResult, fees] = await Promise.all([
    canViewEnrollmentApplication
      ? client
        .from('season_profiles')
        .select('enrollment_application_delivered')
        .eq('profile_id', subject.profileId)
        .eq('season_id', subject.activeSeason?.id ?? '')
        .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    canViewMedicalCertificate
      ? client
        .from('athlete_profiles')
        .select('medical_certificate_expiry')
        .eq('profile_id', subject.profileId)
        .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    canViewFees
      ? loadAthleteFeesContract(client, subject.profileId, subject.activeTeamIds ?? [])
      : Promise.resolve(null),
  ])

  if (seasonProfileResult.error) throw new Error('Impossibile caricare la domanda di iscrizione')
  if (athleteProfileResult.error) throw new Error('Impossibile caricare il certificato medico')

  const seasonProfile = seasonProfileResult.data as SeasonProfileRow | null
  const athleteProfile = athleteProfileResult.data as AthleteProfileRow | null
  return buildAthleteAdministrationContract({
    delegated: subject.delegated,
    permissions: subject.permissions,
    enrollmentApplicationDelivered: seasonProfile?.enrollment_application_delivered ?? null,
    medicalCertificateExpiry: athleteProfile?.medical_certificate_expiry ?? null,
    fees,
  })
}
