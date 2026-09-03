import { getCertificateStatus, isCertificateAttentionStatus } from './certificate-status'

describe('certificate status', () => {
  const now = new Date(2026, 8, 3, 12, 0, 0)

  it('classifies missing, expired, expiring and valid certificates consistently', () => {
    expect(getCertificateStatus(null, now)).toBe('missing')
    expect(getCertificateStatus('2026-09-02', now)).toBe('expired')
    expect(getCertificateStatus('2026-09-20', now)).toBe('expiring')
    expect(getCertificateStatus('2026-10-04', now)).toBe('valid')
  })

  it('keeps the expiry day non-expired through its local end of day', () => {
    expect(getCertificateStatus('2026-09-03', now)).toBe('expiring')
  })

  it('marks every non-valid status as requiring attention', () => {
    expect(isCertificateAttentionStatus('missing')).toBe(true)
    expect(isCertificateAttentionStatus('expired')).toBe(true)
    expect(isCertificateAttentionStatus('expiring')).toBe(true)
    expect(isCertificateAttentionStatus('valid')).toBe(false)
  })
})
