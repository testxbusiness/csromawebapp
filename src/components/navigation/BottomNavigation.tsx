'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Banknote, CalendarDays, ClipboardCheck, Home, MessageSquare, MoreHorizontal, Trophy, UserRound } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { useAccessibleProfiles } from '@/context/AccessibleProfileContext'
import { resolveFamilyNavigation } from '@/lib/navigation/family-navigation'
import { useAthleteUnreadMessageCount } from '@/lib/athlete/unread-messages'

const personalItems = [
  { href: '/dashboard', label: 'Oggi', icon: Home },
  { href: '/athlete/calendar', label: 'Calendario', icon: CalendarDays },
  { href: '/athlete/campionati', label: 'Campionato', icon: Trophy },
  { href: '/athlete/messages', label: 'Messaggi', icon: MessageSquare },
  { href: '/athlete/profile', label: 'Profilo', icon: UserRound },
] as const

const coachItems = [
  { href: '/dashboard', label: 'Oggi', icon: Home },
  { href: '/coach/calendar', label: 'Calendario', icon: CalendarDays },
  { href: '/coach/campionati', label: 'Convocazioni', icon: ClipboardCheck },
  { href: '/coach/messages', label: 'Messaggi', icon: MessageSquare },
  { href: '/coach/profile', label: 'Altro', icon: MoreHorizontal },
] as const

const familyIcons = { dashboard: Home, calendar: CalendarDays, championship: Trophy, messages: MessageSquare, fees: Banknote, profile: UserRound } as const

export function BottomNavigation({ unreadCount = 0 }: { unreadCount?: number }) {
  const pathname = usePathname() ?? ''
  const { role } = useAuth()
  const { activeArea, selectedProfile } = useAccessibleProfiles()
  const isCoach = role === 'coach'
  const isFamilyView = activeArea === 'family'
  const familyNavigation = isFamilyView ? resolveFamilyNavigation(selectedProfile) : null
  const items = isCoach
    ? coachItems
    : isFamilyView
    ? familyNavigation!.items.map((item) => ({ ...item, icon: familyIcons[item.key] }))
    : personalItems
  const unreadQuery = useAthleteUnreadMessageCount()

  if (isCoach) {
    return (
      <nav className="cs-bottomnav cs-bottom-navigation" data-item-count={coachItems.length} aria-label="Navigazione coach">
        {coachItems.map(({ href, label, icon: Icon }) => {
          const active = href === '/dashboard' ? pathname === href : pathname === href || pathname.startsWith(`${href}/`)
          return (
            <Link key={href} href={href} className={cn('cs-bottom-navigation__item', active && 'is-active')} aria-current={active ? 'page' : undefined}>
              <span className="cs-bottom-navigation__icon"><Icon aria-hidden="true" /></span>
              <span>{label}</span>
            </Link>
          )
        })}
      </nav>
    )
  }

  if ((role !== 'athlete' && role !== 'family_member') || (activeArea !== 'personal' && !selectedProfile)) return null
  const messageCount = unreadQuery.data ?? unreadCount

  return (
      <nav className="cs-bottomnav cs-bottom-navigation" data-item-count={items.length} aria-label={isFamilyView ? 'Navigazione area familiare' : 'Navigazione atleta'}>
      {items.map(({ href, label, icon: Icon }) => {
        const active = href === '/dashboard' ? pathname === href : pathname === href || pathname.startsWith(`${href}/`)
        return (
          <Link key={href} href={href} className={cn('cs-bottom-navigation__item', active && 'is-active')} aria-current={active ? 'page' : undefined}>
            <span className="cs-bottom-navigation__icon"><Icon aria-hidden="true" /></span>
            <span>{label}</span>
            {label === 'Messaggi' && messageCount > 0 ? <span className="cs-bottom-navigation__badge" aria-label={`${messageCount} messaggi non letti`}>{messageCount > 9 ? '9+' : messageCount}</span> : null}
          </Link>
        )
      })}
    </nav>
  )
}
