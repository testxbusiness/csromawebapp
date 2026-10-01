export type CertificateStatus = 'valid' | 'missing' | 'expired' | 'expiring'

function parseCertificateExpiry(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null

  const [, year, month, day] = match
  const expiry = new Date(Number(year), Number(month) - 1, Number(day), 23, 59, 59, 999)
  if (
    Number.isNaN(expiry.getTime())
    || expiry.getFullYear() !== Number(year)
    || expiry.getMonth() !== Number(month) - 1
    || expiry.getDate() !== Number(day)
  ) return null
  return expiry
}

export function getCertificateStatus(
  expiryValue: string | null | undefined,
  now = new Date(),
): CertificateStatus {
  if (!expiryValue) return 'missing'

  const expiry = parseCertificateExpiry(expiryValue)
  if (!expiry) return 'missing'
  if (expiry.getTime() < now.getTime()) return 'expired'
  const expiringThreshold = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 30, 23, 59, 59, 999)
  if (expiry.getTime() <= expiringThreshold.getTime()) return 'expiring'
  return 'valid'
}

export function isCertificateAttentionStatus(status: CertificateStatus): boolean {
  return status !== 'valid'
}
