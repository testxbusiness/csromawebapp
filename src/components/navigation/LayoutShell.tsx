'use client'

import { useState, useEffect, useRef } from 'react'
import { NextStepViewport } from 'nextstepjs'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { X } from 'lucide-react'
import RoleSidebar from './RoleSidebar'
import { useAuth } from '@/hooks/useAuth'
import ThemeToggle from '@/components/ui/ThemeToggle'
import AppHeader from './AppHeader'
import { BottomNavigation } from './BottomNavigation'
import { useAccessibleProfiles } from '@/context/AccessibleProfileContext'
import { SubjectSwitcher } from './SubjectSwitcher'
import { TeamSwitcher } from './TeamSwitcher'

export default function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || ''
  const showAuthenticatedLayout = /^\/(admin|coach|athlete|dashboard)(\/|$)/.test(pathname)

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [headerContextMounted, setHeaderContextMounted] = useState(false)

  const { profile, account, role, user, loading, profileLoading, signOut, silentRefresh } = useAuth()
  const { activeArea, selectedProfile } = useAccessibleProfiles()
  const router = useRouter()
  const prevPathRef = useRef(pathname)
  const lastRefreshedPathRef = useRef<string | null>(null)

  useEffect(() => {
    setHeaderContextMounted(true)
  }, [])

  useEffect(() => {
    const prev = prevPathRef.current
    prevPathRef.current = pathname
    const changed = prev !== pathname
    const isDashboard = pathname === '/dashboard'
    const isProfilePage = /^\/(admin\/profile|coach\/profile|athlete\/profile)(\/|$)/.test(pathname)
    const cameFromOther = changed && prev !== '/dashboard'
    const shouldRefresh = (isDashboard && cameFromOther) || (isProfilePage && cameFromOther)

    if (shouldRefresh && user && lastRefreshedPathRef.current !== pathname) {
      lastRefreshedPathRef.current = pathname
      silentRefresh().catch(() => {})
    }
  }, [pathname, user, silentRefresh])

  const mustChangePasswordChecked = useRef(false)

  useEffect(() => {
    if (!profile || mustChangePasswordChecked.current) return

    const mustChange = account?.mustChangePassword === true
    if (!mustChange) {
      mustChangePasswordChecked.current = true
      return
    }

    if (pathname === '/reset-password') return

    try {
      const hasBypass = typeof document !== 'undefined' && document.cookie.includes('csr_pw_reset=1')
      if (hasBypass) {
        document.cookie = 'csr_pw_reset=; path=/; max-age=0'
        mustChangePasswordChecked.current = true
        return
      }
    } catch {}

    const next = encodeURIComponent(pathname || '/dashboard')
    router.replace(`/reset-password?next=${next}`)
  }, [account?.mustChangePassword, profile, pathname, router])

  const handleSignOut = async () => {
    try {
      await signOut()
    } finally {
      router.replace('/login')
    }
  }

  if (!showAuthenticatedLayout) return <>{children}</>

  const hasUserData = !!user || !!profile
  const shouldShowSkeleton = loading && !hasUserData
  const shouldShowProfileLoading = !!user && !profile && profileLoading

  const fallbackFirst =
    (user as any)?.user_metadata?.first_name || (user?.email ? user.email.split('@')[0] : '')
  const fallbackLast = (user as any)?.user_metadata?.last_name || ''

  const first = profile?.first_name ?? fallbackFirst
  const last = profile?.last_name ?? fallbackLast

  const initials = (first || last)
    ? [first, last]
        .filter(Boolean)
        .map((w: string) => w.at(0)?.toUpperCase())
        .join('')
        .slice(0, 2)
    : 'CS'

  const roleLabel = role ? roleName(role) : user ? 'Utente' : ''
  const isAdminShell = role === 'admin' && (/^\/admin(\/|$)/.test(pathname) || pathname === '/dashboard')
  const profileHref = role === 'admin' ? '/admin/profile' : role === 'coach' ? '/coach/profile' : role === 'athlete' ? '/athlete/profile' : '/dashboard'
  const showBottomNavigation = role === 'coach' || ((role === 'athlete' || role === 'family_member') && (activeArea === 'personal' || (activeArea === 'family' && Boolean(selectedProfile))))

  const UserBadge = () => {
    if (shouldShowSkeleton) {
      return (
        <div className="flex items-center gap-3 rounded-full border border-[color:var(--cs-border)] bg-[color:var(--cs-surface)] px-3 py-1.5 text-left shadow-sm">
          <div className="cs-avatar cs-bg-primary animate-pulse" />
          <div className="hidden sm:block min-w-[120px]">
            <div className="h-3 w-24 bg-[color:var(--cs-border)] rounded animate-pulse mb-1" />
            <div className="h-2 w-16 bg-[color:var(--cs-border)] rounded animate-pulse" />
          </div>
        </div>
      )
    }

    return (
      <Link href={profileHref} aria-label="Apri il profilo account" className="flex items-center gap-3 rounded-full border border-[color:var(--cs-border)] bg-[color:var(--cs-surface)] px-3 py-1.5 text-left shadow-sm">
        <div className="cs-avatar cs-bg-primary">
          <span className="text-sm font-semibold">{initials}</span>
        </div>
        <div className="hidden sm:block">
          <p className="text-sm font-semibold text-[color:var(--cs-text)]">
            {`${first ?? ''} ${last ?? ''}`.trim() || user?.email || 'Utente CSRoma'}
          </p>
          {roleLabel && (
            <p className="text-xs text-[color:var(--cs-text-secondary)]">
              {roleLabel}
              {shouldShowProfileLoading && ' • Caricamento...'}
            </p>
          )}
        </div>
      </Link>
    )
  }

  return (
    <div className="cs-page">
      <AppHeader
        variant={isAdminShell ? 'admin' : pathname === '/dashboard' ? 'mobile-root' : 'mobile-detail'}
        onMenuOpen={() => setMobileMenuOpen(true)}
        onBack={() => router.back()}
        onSignOut={handleSignOut}
        account={<UserBadge />}
        context={headerContextMounted ? (
          <>
            {isAdminShell ? <span className="cs-admin-topbar__section">Amministrazione</span> : null}
            {activeArea === 'family' ? (
              <>
                <SubjectSwitcher variant="desktop" />
                <SubjectSwitcher variant="mobile" />
              </>
            ) : null}
            {(role === 'athlete' || role === 'coach' || activeArea === 'family') ? (
              <>
                <TeamSwitcher variant="desktop" />
                <TeamSwitcher variant="mobile" />
              </>
            ) : null}
          </>
        ) : null}
        utilities={<ThemeToggle />}
      />

      <div className={isAdminShell ? 'cs-layout cs-admin-layout' : 'cs-layout'}>
        <aside className={isAdminShell ? 'cs-sidebar cs-sidebar--admin' : role === 'coach' ? 'cs-sidebar cs-sidebar--coach' : 'cs-sidebar'}>
          <RoleSidebar variant={isAdminShell ? 'admin' : 'desktop'} />
        </aside>

        <main className={isAdminShell ? 'cs-main cs-admin-workspace' : showBottomNavigation ? 'cs-main cs-main--athlete cs-main--with-bottomnav' : 'cs-main'}>
          <NextStepViewport id="app-viewport">{children}</NextStepViewport>
        </main>
      </div>

      <BottomNavigation />

      {mobileMenuOpen && (
        <div className="lg:hidden">
          <div className="cs-overlay" aria-hidden="false" onClick={() => setMobileMenuOpen(false)} />
          <div className="cs-drawer" aria-hidden="false">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-[color:var(--cs-text-secondary)]">CSRoma</p>
                <p className="text-base font-semibold text-[color:var(--cs-primary)]">Navigazione</p>
              </div>
              <button
                type="button"
                className="cs-btn cs-btn--ghost cs-btn--icon"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Chiudi menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <RoleSidebar variant="mobile" onNavigate={() => setMobileMenuOpen(false)} />

            <div className="mt-8 space-y-2">
              <p className="text-xs uppercase tracking-[0.12em] text-[color:var(--cs-text-secondary)]">Account</p>
              <div className="cs-card">
                {shouldShowSkeleton ? (
                  <>
                    <div className="h-3 w-28 bg-[color:var(--cs-border)] rounded animate-pulse mb-1" />
                    <div className="h-2 w-20 bg-[color:var(--cs-border)] rounded animate-pulse" />
                  </>
                ) : (
                  <>
                    <p className="text-sm font-semibold text-[color:var(--cs-text)]">
                      {`${first ?? ''} ${last ?? ''}`.trim() || user?.email || 'Utente CSRoma'}
                    </p>
                    {roleLabel && (
                      <p className="text-xs text-[color:var(--cs-text-secondary)]">
                        {roleLabel}
                        {shouldShowProfileLoading && ' • Caricamento...'}
                      </p>
                    )}
                  </>
                )}
                <button
                  type="button"
                  onClick={async () => {
                    setMobileMenuOpen(false)
                    await handleSignOut()
                  }}
                  className="cs-btn cs-btn--primary cs-btn--block mt-3"
                >
                  Esci
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function roleName(role: string): string {
  switch (role) {
    case 'admin':
      return 'Amministratore'
    case 'coach':
      return 'Allenatore'
    case 'athlete':
      return 'Atleta'
    case 'family_member':
      return 'Familiare / Tutore'
    default:
      return 'Utente CSRoma'
  }
}
