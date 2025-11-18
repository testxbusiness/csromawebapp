'use client'

import { memo, useMemo } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
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
  User,
  UserCog,
  UsersRound,
  Wallet2,
} from 'lucide-react'

type Role = 'admin' | 'coach' | 'athlete'

type NavItem = {
  href: string
  label: string
  icon: LucideIcon
}

const adminItems: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LineChart },
  { href: '/admin/seasons', label: 'Stagioni', icon: Flag },
  { href: '/admin/activities', label: 'Attività', icon: Activity },
  { href: '/admin/teams', label: 'Squadre', icon: UsersRound },
  { href: '/admin/users', label: 'Utenti', icon: ClipboardList },
  { href: '/admin/atleti', label: 'Iscritti', icon: User },
  { href: '/admin/collaboratori', label: 'Collaboratori', icon: UserCog },
  { href: '/admin/gyms', label: 'Palestre', icon: Building2 },
  { href: '/admin/calendar', label: 'Calendario', icon: CalendarDays },
  { href: '/admin/messages', label: 'Messaggi', icon: MessageSquare },
  { href: '/admin/membership-fees', label: 'Quote Associative', icon: Wallet2 },
  { href: '/admin/incassi', label: 'Incassi', icon: Banknote },
  { href: '/admin/payments', label: 'Pagamenti', icon: CreditCard },
  { href: '/admin/balance', label: 'Bilancio', icon: BarChart3 },
  { href: '/admin/documents', label: 'Documenti', icon: FileText },
  { href: '/admin/profile', label: 'Profilo', icon: CircleUser },
]

const coachItems: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LineChart },
  { href: '/coach/calendar', label: 'Calendario', icon: CalendarClock },
  { href: '/coach/messages', label: 'Messaggi', icon: Mail },
  { href: '/coach/payments', label: 'Pagamenti', icon: CreditCard },
  { href: '/coach/profile', label: 'Profilo', icon: UserCog },
]

const athleteItems: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LineChart },
  { href: '/athlete/calendar', label: 'Calendario', icon: CalendarClock },
  { href: '/athlete/messages', label: 'Messaggi', icon: Mail },
  { href: '/athlete/fees', label: 'Quote Associative', icon: Wallet2 },
  { href: '/athlete/profile', label: 'Profilo', icon: UserCog },
]

const getItemsForRole = (role: Role | undefined): NavItem[] => {
  if (role === 'admin') return adminItems
  if (role === 'coach') return coachItems
  if (role === 'athlete') return athleteItems
  return []
}

interface RoleSidebarProps {
  variant?: 'desktop' | 'mobile'
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

const RoleSidebar = memo(({ variant = 'desktop', onNavigate }: RoleSidebarProps) => {
  const { profile, loading } = useAuth()
  const pathname = usePathname()

  const items = useMemo(() => getItemsForRole(profile?.role), [profile?.role])

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

  if (!items.length) return null

  const description =
    variant === 'mobile'
      ? 'Scegli una sezione da aprire e gestire.'
      : 'Gestisci rapidamente le aree della tua società.'

  return (
    <div className={`flex flex-col gap-6 ${variant === 'mobile' ? '' : 'sticky top-6'}`}>
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--cs-text-tertiary)]">Navigazione</p>
        <p className="text-sm text-[color:var(--cs-text-secondary)]">{description}</p>
      </div>

      <nav className="flex flex-col gap-1">
        {items.map(({ href, label, icon }) => {
          const active = pathname?.startsWith(href)

          return <NavItem key={href} href={href} label={label} icon={icon} active={active} onNavigate={onNavigate} />
        })}
      </nav>
    </div>
  )
})

RoleSidebar.displayName = 'RoleSidebar'

export default RoleSidebar
