'use client'

import { memo, useMemo } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { useAccessibleProfiles } from '@/context/AccessibleProfileContext'
import type { LucideIcon } from 'lucide-react'
import {
  Activity,
  Banknote,
  BarChart3,
  Building2,
  CalendarClock,
  CalendarDays,
  CircleUser,
  ClipboardList,
  CreditCard,
  FileText,
  Flag,
  LineChart,
  Mail,
  MessageSquare,
  Trophy,
  User,
  UserCog,
  UsersRound,
  Wallet2,
} from 'lucide-react'
import { resolveFamilyNavigation } from '@/lib/navigation/family-navigation'

type Role = 'admin' | 'coach' | 'athlete' | 'family_member'

type NavItem = {
  href: string
  label: string
  icon: LucideIcon
}

type NavGroup = {
  label: string
  items: NavItem[]
}

const adminGroups: NavGroup[] = [
  {
    label: 'Panoramica',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LineChart },
      { href: '/admin/calendar', label: 'Calendario', icon: CalendarDays },
    ],
  },
  {
    label: 'Sport',
    items: [
      { href: '/admin/seasons', label: 'Stagioni', icon: Flag },
      { href: '/admin/activities', label: 'Attività', icon: Activity },
      { href: '/admin/teams', label: 'Squadre', icon: UsersRound },
      { href: '/admin/campionati', label: 'Campionati', icon: Trophy },
      { href: '/admin/gyms', label: 'Palestre', icon: Building2 },
    ],
  },
  {
    label: 'Persone',
    items: [
      { href: '/admin/profiles', label: 'Anagrafica', icon: UsersRound },
      { href: '/admin/atleti', label: 'Atleti', icon: User },
      { href: '/admin/collaboratori', label: 'Collaboratori', icon: UserCog },
      { href: '/admin/users', label: 'Account e accessi', icon: ClipboardList },
    ],
  },
  {
    label: 'Comunicazione',
    items: [
      { href: '/admin/messages', label: 'Messaggi', icon: MessageSquare },
      { href: '/admin/documents', label: 'Documenti', icon: FileText },
    ],
  },
  {
    label: 'Amministrazione',
    items: [
      { href: '/admin/membership-fees', label: 'Quote', icon: Wallet2 },
      { href: '/admin/incassi', label: 'Incassi', icon: Banknote },
      { href: '/admin/payments', label: 'Uscite', icon: CreditCard },
      { href: '/admin/balance', label: 'Bilancio', icon: BarChart3 },
    ],
  },
]

const adminAccountItems: NavItem[] = [
  { href: '/admin/profile', label: 'Profilo', icon: CircleUser },
]

const coachItems: NavItem[] = [
  { href: '/dashboard', label: 'Oggi', icon: LineChart },
  { href: '/coach/calendar', label: 'Calendario', icon: CalendarClock },
  { href: '/coach/campionati', label: 'Convocazioni', icon: Trophy },
  { href: '/coach/messages', label: 'Messaggi', icon: Mail },
]

const coachMoreItems: NavItem[] = [
  { href: '/coach/payments', label: 'Pagamenti', icon: CreditCard },
  { href: '/coach/profile', label: 'Profilo', icon: UserCog },
]

const athleteItems: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LineChart },
  { href: '/athlete/campionati', label: 'Campionati', icon: Trophy },
  { href: '/athlete/calendar', label: 'Calendario', icon: CalendarClock },
  { href: '/athlete/messages', label: 'Messaggi', icon: Mail },
  { href: '/athlete/fees', label: 'Quote Associative', icon: Wallet2 },
  { href: '/athlete/profile', label: 'Profilo', icon: UserCog },
]

const getItemsForRole = (role: Role | undefined, selectedProfile: ReturnType<typeof useAccessibleProfiles>['selectedProfile']): NavItem[] => {
  if (role === 'coach') return coachItems
  if (role === 'athlete') return athleteItems
  if (role === 'family_member') {
    const navigation = resolveFamilyNavigation(selectedProfile)
    return navigation.items.map((item) => ({
      href: item.href,
      label: item.key === 'dashboard' ? 'Area familiare' : item.label === 'Quote' ? 'Quote Associative' : item.label,
      icon: item.key === 'dashboard' ? UsersRound : item.key === 'calendar' ? CalendarClock : item.key === 'championship' ? Trophy : item.key === 'messages' ? Mail : item.key === 'fees' ? Wallet2 : UserCog,
    }))
  }
  return []
}

interface RoleSidebarProps {
  variant?: 'desktop' | 'mobile' | 'admin'
  onNavigate?: () => void
}

const NavItem = memo(
  ({
    href,
    label,
    icon: Icon,
    active,
    onNavigate,
  }: {
    href: string
    label: string
    icon: LucideIcon
    active: boolean
    onNavigate?: () => void
  }) => {
    return (
      <Link
        href={href}
        onClick={onNavigate}
        aria-current={active ? 'page' : undefined}
        className={`group flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-150 ${
          active
            ? 'bg-[color:var(--cs-primary)]/10 text-[color:var(--cs-primary)] shadow-[0_12px_26px_rgba(15,28,63,0.08)]'
            : 'text-[color:var(--cs-text-secondary)] hover:bg-white/70 hover:text-[color:var(--cs-primary)]'
        }`}
      >
        <Icon
          className={`h-4 w-4 ${
            active
              ? 'text-[color:var(--cs-primary)]'
              : 'text-[color:var(--cs-text-tertiary)] group-hover:text-[color:var(--cs-primary)]'
          }`}
        />
        <span className="truncate">{label}</span>
      </Link>
    )
  }
)

NavItem.displayName = 'NavItem'

function AdminNavigation({ pathname, onNavigate }: { pathname: string | null; onNavigate?: () => void }) {
  return (
    <div className="cs-admin-navigation">
      <nav aria-label="Navigazione amministrazione" className="flex flex-col gap-5">
        {adminGroups.map((group) => (
          <section key={group.label} aria-labelledby={`admin-nav-${group.label.toLowerCase()}`} className="space-y-2">
            <h2 id={`admin-nav-${group.label.toLowerCase()}`} className="cs-admin-nav-heading">
              {group.label}
            </h2>
            <div className="flex flex-col gap-1">
              {group.items.map(({ href, label, icon }) => (
                <NavItem
                  key={href}
                  href={href}
                  label={label}
                  icon={icon}
                  active={pathname === href || pathname?.startsWith(`${href}/`) === true}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          </section>
        ))}
      </nav>

      <section aria-labelledby="admin-nav-account" className="cs-admin-account-nav">
        <h2 id="admin-nav-account" className="cs-admin-nav-heading">Account</h2>
        <div className="flex flex-col gap-1">
          {adminAccountItems.map(({ href, label, icon }) => (
            <NavItem
              key={href}
              href={href}
              label={label}
              icon={icon}
              active={pathname === href || pathname?.startsWith(`${href}/`) === true}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      </section>
    </div>
  )
}

const RoleSidebar = memo(({ variant = 'desktop', onNavigate }: RoleSidebarProps) => {
  const { role, account, loading } = useAuth()
  const {
    profiles,
    selectedProfile,
    activeArea,
    loading: accessibleProfilesLoading,
    setActiveArea,
    setSelectedProfileId,
  } = useAccessibleProfiles()
  const pathname = usePathname()

  const hasFamilyAccess = Boolean(
    account?.roles.includes('family_member') || (!accessibleProfilesLoading && profiles.length > 0)
  )
  const effectiveRole = role === 'athlete' && hasFamilyAccess && activeArea === 'family'
    ? 'family_member'
    : role as Role | undefined

  const items = useMemo(() => {
    const roleItems = getItemsForRole(effectiveRole, selectedProfile)
    const hasDualArea = hasFamilyAccess && role !== 'family_member'

    if (!hasDualArea) return roleItems

    return [
      ...roleItems,
      {
        href: '/dashboard',
        label: activeArea === 'family' ? 'Area personale' : 'Area familiare',
        icon: activeArea === 'family' ? User : UsersRound,
      },
    ]
  }, [activeArea, effectiveRole, hasFamilyAccess, role, selectedProfile])

  const moreItems = useMemo(() => {
    if (effectiveRole === 'coach') return coachMoreItems
    if (effectiveRole !== 'family_member') return []
    return resolveFamilyNavigation(selectedProfile).moreItems.map((item) => ({
      href: item.href,
      label: item.label,
      icon: item.key === 'profile' ? UserCog : item.key === 'fees' ? Wallet2 : LineChart,
    }))
  }, [effectiveRole, selectedProfile])

  if (loading) {
    return (
      <div className={`flex flex-col gap-3 ${variant === 'mobile' ? '' : 'sticky top-6'}`}>
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--cs-text-tertiary)]">Navigazione</p>
          <div className="cs-skeleton w-32 h-3" />
        </div>
        <div className="flex flex-col gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-2.5">
              <div className="cs-skeleton w-4 h-4 rounded" />
              <div className="cs-skeleton w-24 h-3" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (effectiveRole !== 'admin' && !items.length) return null

  const description =
    variant === 'mobile'
      ? 'Scegli una sezione da aprire e gestire.'
      : 'Gestisci rapidamente le aree della tua società.'

  return (
    <div className={`flex flex-col gap-6 ${variant === 'mobile' ? '' : 'sticky top-6'} ${variant === 'admin' ? 'cs-admin-sidebar-content' : ''}`}>
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--cs-text-tertiary)]">Navigazione</p>
        <p className="text-sm text-[color:var(--cs-text-secondary)]">{description}</p>
      </div>

      {effectiveRole === 'admin' ? (
        <AdminNavigation pathname={pathname} onNavigate={onNavigate} />
      ) : null}

      {effectiveRole !== 'admin' ? <nav className="flex flex-col gap-1">
        {items.map(({ href, label, icon }) => {
          const isFamilyAreaItem = label === 'Area familiare'
          const isPersonalAreaItem = label === 'Area personale'
          const isDashboardItem = label === 'Dashboard'
          const onDashboard = pathname?.startsWith('/dashboard')
          const active = isFamilyAreaItem
            ? onDashboard && activeArea === 'family' && !selectedProfile
            : isPersonalAreaItem
              ? onDashboard && activeArea === 'personal'
              : isDashboardItem && effectiveRole === 'family_member'
                ? onDashboard && activeArea === 'family' && Boolean(selectedProfile)
                : pathname?.startsWith(href)
          const shouldClearSubject = isFamilyAreaItem || isPersonalAreaItem

          return (
            <NavItem
              key={`${href}-${label}`}
              href={href}
              label={label}
              icon={icon}
              active={active}
              onNavigate={() => {
                if (shouldClearSubject) {
                  setSelectedProfileId(null)
                  setActiveArea(isPersonalAreaItem ? 'personal' : 'family')
                }
                onNavigate?.()
              }}
            />
          )
        })}
      </nav> : null}
      {moreItems.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--cs-text-tertiary)]">Altro</p>
          <nav className="flex flex-col gap-1" aria-label="Altre destinazioni">
            {moreItems.map(({ href, label, icon: Icon }) => (
              <NavItem key={href} href={href} label={label} icon={Icon} active={pathname?.startsWith(href)} onNavigate={onNavigate} />
            ))}
          </nav>
        </div>
      ) : null}
    </div>
  )
})

RoleSidebar.displayName = 'RoleSidebar'

export default RoleSidebar
