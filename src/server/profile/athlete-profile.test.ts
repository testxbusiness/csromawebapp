import { buildAthleteProfileContract } from './athlete-profile'
import type { SubjectPermissions } from '@/server/auth/require-subject-profile'

const permissions: SubjectPermissions = {
  view_schedule: true, confirm_attendance: false, view_payments: false, view_medical_status: true,
  view_documents: false, sign_documents: false, receive_messages: false,
}
const account = { authUserId: 'auth-1', ownerProfileId: 'profile-1', accountStatus: 'active' as const, roles: ['athlete' as const], mustChangePassword: false }
const profile = { id: 'profile-1', first_name: 'Luca', last_name: 'Rossi', email: 'luca@example.test', phone: '123', birth_date: '2010-01-01' }
const team = { id: 'team-1', name: 'U16', code: 'U16-E', activity_id: 'activity-1' }
const activity = { id: 'activity-1', name: 'Volley' }

describe('athlete profile contract', () => {
  it('separates account, subject, athlete data and team-specific jersey', () => {
    const result = buildAthleteProfileContract({
      account,
      subject: { profileId: 'profile-1', delegated: false, permissions },
      profile,
      athleteProfile: { profile_id: 'profile-1', membership_number: 'T-10', medical_certificate_expiry: '2026-12-31' },
      memberships: [{ id: 'membership-1', team_id: 'team-1', jersey_number: 7 }],
      teams: new Map([[team.id, team]]),
      activities: new Map([[activity.id, activity]]),
      now: new Date('2026-08-29T12:00:00Z'),
    })

    expect(result.account).toEqual({ status: 'active', roles: ['athlete'], must_change_password: false })
    expect(result.subject).toEqual({ ...profile, delegated: false })
    expect(result.athlete.membership_number).toBe('T-10')
    expect(result.athlete.medical).toEqual({ status: 'valid', expires_at: '2026-12-31' })
    expect(result.memberships[0]).toEqual({ id: 'membership-1', jersey_number: 7, team: { id: team.id, name: team.name, code: team.code, activity } })
  })

  it('hides medical detail from delegated subjects while retaining permission flags', () => {
    const result = buildAthleteProfileContract({
      account,
      subject: { profileId: 'profile-2', delegated: true, permissions },
      profile: { ...profile, id: 'profile-2' },
      athleteProfile: { profile_id: 'profile-2', membership_number: 'T-11', medical_certificate_expiry: '2026-09-10' },
      memberships: [], teams: new Map(), activities: new Map(), now: new Date('2026-08-29T12:00:00Z'),
    })

    expect(result.permissions.view_medical_status).toBe(true)
    expect(result.athlete.medical).toEqual({ status: 'expiring', expires_at: null })
    expect(result.athlete.documents).toEqual({ can_view: false, can_sign: false, items: [] })
    expect(JSON.stringify(result)).not.toContain('personal_notes')
  })

  it('does not disclose medical state when the relationship lacks permission', () => {
    const result = buildAthleteProfileContract({
      account,
      subject: { profileId: 'profile-2', delegated: true, permissions: { ...permissions, view_medical_status: false } },
      profile: { ...profile, id: 'profile-2' },
      athleteProfile: { profile_id: 'profile-2', medical_certificate_expiry: '2026-09-10' },
      memberships: [], teams: new Map(), activities: new Map(), now: new Date('2026-08-29T12:00:00Z'),
    })

    expect(result.athlete.medical).toEqual({ status: 'hidden', expires_at: null })
  })

  it('returns document metadata only for a subject with document visibility', () => {
    const result = buildAthleteProfileContract({
      account,
      subject: { profileId: 'profile-2', delegated: true, permissions: { ...permissions, view_documents: true, sign_documents: true } },
      profile: { ...profile, id: 'profile-2' },
      athleteProfile: null,
      memberships: [], teams: new Map(), activities: new Map(),
      documents: [{ id: 'document-1', title: 'Modulo iscrizione', status: 'generated', file_name: 'modulo.pdf', created_at: '2026-08-20T10:00:00Z' }],
    })

    expect(result.athlete.documents).toEqual({
      can_view: true,
      can_sign: true,
      items: [{ id: 'document-1', title: 'Modulo iscrizione', status: 'generated', file_name: 'modulo.pdf', created_at: '2026-08-20T10:00:00Z' }],
    })
  })

})
