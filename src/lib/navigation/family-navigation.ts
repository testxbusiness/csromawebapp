import type { AccessibleProfile } from '@/context/AccessibleProfileContext'

export type FamilyNavigationKey = 'dashboard' | 'calendar' | 'championship' | 'messages' | 'fees' | 'profile'

export type FamilyNavigationItem = {
  key: FamilyNavigationKey
  href: string
  label: string
  permission?: keyof AccessibleProfile['relationship']['permissions']
}

export type FamilyNavigation = {
  items: FamilyNavigationItem[]
  moreItems: FamilyNavigationItem[]
}

type FamilyNavigationSubject = {
  relationship: {
    permissions: AccessibleProfile['relationship']['permissions']
  }
}

const navigationItems: FamilyNavigationItem[] = [
  { key: 'dashboard', href: '/dashboard', label: 'Oggi' },
  { key: 'calendar', href: '/athlete/calendar', label: 'Calendario', permission: 'view_schedule' },
  // Championship data is part of the schedule permission boundary until a
  // separate relationship permission exists in the domain model.
  { key: 'championship', href: '/athlete/campionati', label: 'Campionato', permission: 'view_schedule' },
  { key: 'messages', href: '/athlete/messages', label: 'Messaggi', permission: 'receive_messages' },
  { key: 'fees', href: '/athlete/fees', label: 'Quote', permission: 'view_payments' },
  { key: 'profile', href: '/athlete/profile', label: 'Profilo' },
]

export function resolveFamilyNavigation(
  selectedProfile: FamilyNavigationSubject | null | undefined,
): FamilyNavigation {
  if (!selectedProfile) return { items: [navigationItems[0]], moreItems: [] }

  const permitted = navigationItems.filter((item) => (
    !item.permission || selectedProfile.relationship.permissions[item.permission]
  ))

  return {
    items: permitted.slice(0, 5),
    moreItems: permitted.slice(5),
  }
}

export function isFamilyNavigationAllowed(
  key: FamilyNavigationKey,
  selectedProfile: FamilyNavigationSubject | null | undefined,
) {
  const navigation = resolveFamilyNavigation(selectedProfile)
  return [...navigation.items, ...navigation.moreItems].some((item) => item.key === key)
}
