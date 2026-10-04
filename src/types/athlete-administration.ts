import type { CertificateStatus } from '@/lib/athlete/certificate-status'
import type { AthleteFeesContract } from '@/types/athlete-fees'

export type AthleteAdministrationContract = {
  enrollment_application: { delivered: boolean } | null
  medical_certificate: { status: CertificateStatus; expires_at: string | null } | null
  fees: AthleteFeesContract | null
}
