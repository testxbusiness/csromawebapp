import { buildAthleteAdministrationContract, loadAthleteAdministrationContract, loadAthleteDashboardAdministrativeAlerts } from './administration'
import { loadAthleteFeesContract } from './fees'
import type { SubjectAthleteContext, SubjectPermissions } from '@/server/auth/require-subject-profile'

jest.mock('./fees', () => ({ loadAthleteFeesContract: jest.fn() }))

const allPermissions: SubjectPermissions = {
  view_schedule: false,
  confirm_attendance: false,
  view_payments: true,
  view_medical_status: true,
  view_documents: true,
  sign_documents: false,
  receive_messages: false,
}

const fees = { installments: [] }

describe('athlete administration contract', () => {
  it('exposes all three read-only sections to the personal athlete', () => {
    expect(buildAthleteAdministrationContract({
      delegated: false,
      permissions: allPermissions,
      enrollmentApplicationDelivered: true,
      medicalCertificateExpiry: '2026-12-31',
      fees,
      now: new Date(2026, 8, 3, 12, 0, 0),
    })).toEqual({
      enrollment_application: { delivered: true },
      medical_certificate: { status: 'valid', expires_at: '2026-12-31' },
      fees,
    })
  })

  it.each([
    ['documents only', { view_documents: true }, { enrollment_application: { delivered: false }, medical_certificate: null, fees: null }],
    ['medical only', { view_medical_status: true }, { enrollment_application: null, medical_certificate: { status: 'expiring', expires_at: null }, fees: null }],
    ['payments only', { view_payments: true }, { enrollment_application: null, medical_certificate: null, fees }],
  ] as const)('does not disclose denied sections for a delegated subject with %s', (_label, granted, expected) => {
    const contract = buildAthleteAdministrationContract({
      delegated: true,
      permissions: { ...allPermissions, view_payments: false, view_medical_status: false, view_documents: false, ...granted },
      enrollmentApplicationDelivered: false,
      medicalCertificateExpiry: '2026-09-30',
      fees,
      now: new Date(2026, 8, 29, 12, 0, 0),
    })

    expect(contract).toEqual(expected)
    expect(JSON.stringify(contract)).not.toContain('2026-09-30')
  })
})

describe('athlete administration service', () => {
  const feesMock = loadAthleteFeesContract as jest.MockedFunction<typeof loadAthleteFeesContract>

  beforeEach(() => {
    feesMock.mockReset()
  })

  function subjectFor(permissions: Partial<SubjectPermissions>, tableData: Record<string, unknown>): SubjectAthleteContext {
    const from = jest.fn((table: string) => {
      const builder = {
        select: () => builder,
        eq: () => builder,
        maybeSingle: () => Promise.resolve({ data: tableData[table] ?? null, error: null }),
      }
      return builder
    })
    return {
      profileId: 'subject-1',
      delegated: true,
      permissions: { ...allPermissions, view_payments: false, view_medical_status: false, view_documents: false, ...permissions },
      activeSeason: { id: 'season-1', name: '2026/2027', start_date: '2026-09-01', end_date: '2027-06-30', is_active: true },
      activeTeamIds: ['team-1'],
      dataClient: { from } as never,
      account: {} as never,
    }
  }

  it.each([
    ['documents only', { view_documents: true }, { season_profiles: { enrollment_application_delivered: true } }, ['season_profiles']],
    ['medical only', { view_medical_status: true }, { athlete_profiles: { medical_certificate_expiry: '2026-09-30' } }, ['athlete_profiles']],
  ] as const)('queries only the granted data section for %s', async (_label, permissions, tableData, expectedTables) => {
    const subject = subjectFor(permissions, tableData)
    const contract = await loadAthleteAdministrationContract(subject)

    expect((subject.dataClient.from as jest.Mock).mock.calls.map(([table]) => table)).toEqual(expectedTables)
    expect(feesMock).not.toHaveBeenCalled()
    expect(contract.fees).toBeNull()
  })

  it('delegates the payment section to the shared fees contract only when permitted', async () => {
    const subject = subjectFor({ view_payments: true }, {})
    feesMock.mockResolvedValue(fees)

    await expect(loadAthleteAdministrationContract(subject)).resolves.toEqual({
      enrollment_application: null,
      medical_certificate: null,
      fees,
    })
    expect(feesMock).toHaveBeenCalledWith(subject.dataClient, 'subject-1', ['team-1'])
    expect(subject.dataClient.from).not.toHaveBeenCalled()
  })

  it('builds Home alerts from only the independently authorized certificate and fee sections', async () => {
    const subject = subjectFor({ view_medical_status: true, view_payments: true }, {
      athlete_profiles: { medical_certificate_expiry: null },
    })
    feesMock.mockResolvedValue({ installments: [{ id: 'late', status: 'overdue' }] } as never)

    await expect(loadAthleteDashboardAdministrativeAlerts(subject)).resolves.toEqual([
      { area: 'certificate', tone: 'danger', message: 'Certificato medico da consegnare', href: '/athlete/fees?section=certificate' },
      { area: 'fees', tone: 'danger', message: 'Quota associativa scaduta', href: '/athlete/fees?section=fees' },
    ])
    expect((subject.dataClient.from as jest.Mock).mock.calls.map(([table]) => table)).toEqual(['athlete_profiles'])
    expect(feesMock).toHaveBeenCalledWith(subject.dataClient, 'subject-1', ['team-1'])
  })

  it('does not query or disclose administrative alert data when both permissions are denied', async () => {
    const subject = subjectFor({}, {})

    await expect(loadAthleteDashboardAdministrativeAlerts(subject)).resolves.toEqual([])
    expect(subject.dataClient.from).not.toHaveBeenCalled()
    expect(feesMock).not.toHaveBeenCalled()
  })
})
