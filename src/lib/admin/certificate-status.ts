export type CertificateStatus = 'valid' | 'missing' | 'expired' | 'expiring'

const DAY_IN_MS = 24 * 60 * 60 * 1000

function parseCertificateExpiry(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (!match) return null

  const [, year, month, day] = match
  const expiry = new Date(Number(year), Number(month) - 1, Number(day), 23, 59, 59, 999)
  return Number.isNaN(expiry.getTime()) ? null : expiry
}

export function getCertificateStatus(
  expiryValue: string | null | undefined,
  now = new Date(),
): CertificateStatus {
  if (!expiryValue) return 'missing'

  const expiry = parseCertificateExpiry(expiryValue)
  if (!expiry) return 'missing'
  if (expiry.getTime() < now.getTime()) return 'expired'
  if (expiry.getTime() <= now.getTime() + 30 * DAY_IN_MS) return 'expiring'
  return 'valid'
}

export function isCertificateAttentionStatus(status: CertificateStatus): boolean {
  return status !== 'valid'
}
