import { isFamilyNavigationAllowed, resolveFamilyNavigation } from './family-navigation'

const profile = (permissions: Partial<Record<string, boolean>> = {}) => ({
  relationship: {
    permissions: {
      view_schedule: false,
      confirm_attendance: false,
      view_payments: false,
      view_medical_status: false,
      view_documents: false,
      sign_documents: false,
      receive_messages: false,
      ...permissions,
    },
  },
})

describe('resolveFamilyNavigation', () => {
  it('keeps only context when no subject is selected', () => {
    expect(resolveFamilyNavigation(null)).toEqual({
      items: [{ key: 'dashboard', href: '/dashboard', label: 'Oggi' }],
      moreItems: [],
    })
  })

  it('maps subject permissions to destinations and keeps profile available', () => {
    const result = resolveFamilyNavigation(profile({ view_schedule: true, receive_messages: true }))
    expect(result.items.map((item) => item.key)).toEqual(['dashboard', 'calendar', 'championship', 'messages', 'profile'])
    expect(isFamilyNavigationAllowed('fees', profile({ view_schedule: true }))).toBe(false)
  })

  it('moves the sixth permitted destination to More', () => {
    const result = resolveFamilyNavigation(profile({ view_schedule: true, receive_messages: true, view_payments: true }))
    expect(result.items).toHaveLength(5)
    expect(result.moreItems.map((item) => item.key)).toEqual(['profile'])
  })

  it.each([
    ['schedule only', { view_schedule: true }, ['dashboard', 'calendar', 'championship', 'profile']],
    ['payments only', { view_payments: true }, ['dashboard', 'fees', 'profile']],
    ['messages only', { receive_messages: true }, ['dashboard', 'messages', 'profile']],
    ['complete permissions', { view_schedule: true, view_payments: true, receive_messages: true }, ['dashboard', 'calendar', 'championship', 'messages', 'fees', 'profile']],
  ])('supports the family permission matrix: %s', (_label, overrides, expected) => {
    const result = resolveFamilyNavigation(profile(overrides))
    expect([...result.items, ...result.moreItems].map((item) => item.key)).toEqual(expected)
  })
})
