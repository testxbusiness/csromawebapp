'use client'

import { useState, useEffect, useRef } from 'react'
import { NextStepViewport } from 'nextstepjs'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Bell, Menu, X } from 'lucide-react'
import RoleSidebar from './RoleSidebar'
import { useAuth } from '@/hooks/useAuth'
import ThemeToggle from '@/components/ui/ThemeToggle'
import Image from 'next/image'
import { usePush } from '@/hooks/usePush'

export default function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || ''
  const showAuthenticatedLayout = /^\/(admin|coach|athlete|dashboard)(\/|$)/.test(pathname)

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const { profile, role, user, loading, profileLoading, signOut, silentRefresh } = useAuth()
  const router = useRouter()
  const { registerSW } = usePush()

  useEffect(() => {
    registerSW().catch(() => {})
  }, [registerSW])

  const prevPathRef = useRef(pathname)
  const lastRefreshedPathRef = useRef<string | null>(null)

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

    const mustChange = (profile as any)?.must_change_password === true
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
  }, [profile, pathname, router])

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
      <div className="flex items-center gap-3 rounded-full border border-[color:var(--cs-border)] bg-[color:var(--cs-surface)] px-3 py-1.5 text-left shadow-sm">
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
      </div>
    )
  }

  return (
    <div className="cs-page">
      <header className="cs-navbar">
        <div className="cs-navbar__inner cs-container">
          <div className="flex items-center gap-4">
            <button
              type="button"
              className="cs-btn cs-btn--ghost cs-btn--icon lg:!hidden"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Apri navigazione"
            >
              <Menu className="h-5 w-5" />
            </button>

            <Link href="/dashboard" className="flex items-center gap-2 lg:hidden" aria-label="CSRoma – Dashboard">
              <div className="relative h-8 w-8">
                <Image
                  src="/images/logo_CSRoma.png"
                  alt="CSRoma"
                  fill
                  className="object-contain select-none"
                  sizes="32px"
                  priority
                />
              </div>
            </Link>

            <Link href="/dashboard" className="hidden lg:flex items-center gap-3" aria-label="CSRoma – Dashboard">
              <div className="relative h-16 w-16 xl:h-20 xl:w-20">
                <Image
                  src="/images/logo_CSRoma.svg"
                  alt="CSRoma"
                  fill
                  className="object-contain select-none"
                  sizes="(max-width: 1280px) 40px, 48px"
                  priority
                />
              </div>
              <div className="hidden xl:block">
                <p className="text-sm font-semibold text-[color:var(--cs-text-secondary)] leading-none">CSRoma</p>
                <p className="text-lg font-semibold text-[color:var(--cs-primary)] leading-none">Control Center</p>
              </div>
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            <button type="button" className="cs-btn cs-btn--ghost cs-btn--icon" aria-label="Notifiche">
              <Bell className="h-4 w-4" />
            </button>
            <button type="button" onClick={handleSignOut} className="cs-btn cs-btn--primary">
              Esci
            </button>
            <UserBadge />
          </div>
        </div>
      </header>

      <div className="cs-layout">
        <aside className="cs-sidebar">
          <RoleSidebar />
        </aside>

        <main className="cs-main">
          <NextStepViewport id="app-viewport">{children}</NextStepViewport>
        </main>
      </div>

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
    default:
      return 'Utente CSRoma'
  }
}
