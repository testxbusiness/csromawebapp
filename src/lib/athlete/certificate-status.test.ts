import { getCertificateStatus } from './certificate-status'

describe('shared certificate status', () => {
  const now = new Date(2026, 8, 3, 12, 0, 0)

  it.each([
    [null, 'missing'],
    ['2026-09-02', 'expired'],
    ['2026-09-03', 'expiring'],
    ['2026-10-03', 'expiring'],
    ['2026-10-04', 'valid'],
    ['2026-02-30', 'missing'],
  ] as const)('classifies %s as %s at the documented boundaries', (expiry, expected) => {
    expect(getCertificateStatus(expiry, now)).toBe(expected)
  })
})
