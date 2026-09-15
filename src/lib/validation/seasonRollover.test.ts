import {
  activityRolloverChoiceSchema,
  gymRolloverChoiceSchema,
  profileRolloverSelectionSchema,
  rolloverSeasonsSchema,
  teamRolloverMappingSchema,
} from './seasonRollover'

const source = { id: '11111111-1111-4111-8111-111111111111', name: 'Stagione 2025/2026', startDate: '2025-09-01', endDate: '2026-06-30' }
const target = { id: '22222222-2222-4222-8222-222222222222', name: 'Stagione 2026/2027', startDate: '2026-09-01', endDate: '2027-06-30', isActive: false as const }

describe('season rollover contract schemas', () => {
  it('accepts the inactive source/target season contract', () => {
    expect(rolloverSeasonsSchema.safeParse({ source, target }).success).toBe(true)
    expect(rolloverSeasonsSchema.safeParse({ source, target: { ...target, isActive: true } }).success).toBe(false)
  })

  it('accepts explicit copy/link/skip choices and rejects unknown fields', () => {
    expect(gymRolloverChoiceSchema.safeParse({ choice: 'copy' }).success).toBe(true)
    expect(activityRolloverChoiceSchema.safeParse({ choice: 'link', targetId: target.id }).success).toBe(true)
    expect(teamRolloverMappingSchema.safeParse({ choice: 'skip' }).success).toBe(true)
    expect(gymRolloverChoiceSchema.safeParse({ choice: 'copy', targetId: target.id }).success).toBe(false)
  })

  it('requires selected target teams to contain each membership', () => {
    expect(profileRolloverSelectionSchema.safeParse({ profileId: source.id, include: true, targetTeamIds: [target.id], memberships: [{ targetTeamId: target.id, jerseyNumber: 7, role: 'athlete' }] }).success).toBe(true)
    expect(profileRolloverSelectionSchema.safeParse({ profileId: source.id, include: true, targetTeamIds: [], memberships: [{ targetTeamId: target.id }] }).success).toBe(false)
  })
})
