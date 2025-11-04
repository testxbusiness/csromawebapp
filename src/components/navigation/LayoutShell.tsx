'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Bell, Menu, X } from 'lucide-react'
import Image from 'next/image'

import RoleSidebar from './RoleSidebar'
import ThemeToggle from '@/components/ui/ThemeToggle'
import { useAuth } from '@/hooks/useAuth'
import { usePush } from '@/hooks/usePush'

export default function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || ''
  const isProtected = /^\/(admin|coach|athlete|dashboard)(\/|$)/.test(pathname)

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // ⬇️ usa anche authReady dal nuovo useAuth
  const { profile, role, user, authReady, signOut, silentRefresh } = useAuth()
  const router = useRouter()

  // SW (non blocca mai la UI)
  const { registerSW } = usePush()
  useEffect(() => { registerSW().catch(() => {}) }, [registerSW])

  // Chiudi il drawer quando cambia rotta (evita stati appesi in mobile)
  const lastPathRef = useRef(pathname)
  useEffect(() => {
    if (lastPathRef.current !== pathname) {
      setMobileMenuOpen(false)
      lastPathRef.current = pathname
    }
  }, [pathname])

  // Smart refresh: se torni su dashboard o pagina profilo dall’esterno, riallinea session/profile in silenzio
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

  // Forza reset-password solo se il profilo lo richiede (fonte di verità = DB)
  useEffect(() => {
    const mustChange = profile?.must_change_password === true
    if (!mustChange) return
    if (pathname === '/reset-password') return
    const next = encodeURIComponent(pathname || '/dashboard')
    router.replace(`/reset-password?next=${next}`)
  }, [profile?.must_change_password, pathname, router])

  const handleSignOut = async () => {
    try {
      await signOut()
    } finally {
      router.replace('/login')
    }
  }

  // Se non è una rotta protetta, non impongo auth layout
  if (!isProtected) return <>{children}</>

  // ⬇️ Skeleton solo finché l’auth non è pronta (niente combinazioni user/profile)
  if (!authReady) {
    return (
      <div className="cs-page">
        <header className="cs-navbar">
          <div className="cs-navbar__inner cs-container">
            <div className="flex items-center gap-4">
              <div className="h-5 w-5 rounded bg-[color:var(--cs-border)] animate-pulse" />
              <div className="relative h-8 w-8 bg-[color:var(--cs-border)] rounded animate-pulse" />
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-3 rounded-full border border-[color:var(--cs-border)] bg-[color:var(--cs-surface)] px-3 py-1.5">
                <div className="cs-avatar cs-bg-primary animate-pulse" />
                <div className="hidden sm:block min-w-[120px]">
                  <div className="h-3 w-24 bg-[color:var(--cs-border)] rounded animate-pulse mb-1" />
                  <div className="h-2 w-16 bg-[color:var(--cs-border)] rounded animate-pulse" />
                </div>
              </div>
            </div>
          </div>
        </header>
        <div className="cs-layout">
          <aside className="cs-sidebar">
            <div className="space-y-2 p-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="cs-list-item">
                  <div className="cs-skeleton" style={{ width: '140px', height: '12px' }} />
                  <div className="cs-skeleton" style={{ width: '24px', height: '12px' }} />
                </div>
              ))}
            </div>
          </aside>
          <main className="cs-main">
            <div className="cs-skeleton h-8 w-40 mb-4" />
            <div className="cs-card h-[300px]" />
          </main>
        </div>
      </div>
    )
  }

  // Dati utente per la testata
  const fallbackFirst = (user as any)?.user_metadata?.first_name || (user?.email ? user.email.split('@')[0] : '')
  const fallbackLast = (user as any)?.user_metadata?.last_name || ''
  const first = profile?.first_name ?? fallbackFirst
  const last = profile?.last_name ?? fallbackLast
  const initials =
    (first || last)
      ? [first, last].filter(Boolean).map((w: string) => w.at(0)?.toUpperCase()).join('').slice(0, 2)
      : 'CS'

  const roleLabel = role ? roleName(role) : ''

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

            {/* LOGO MOBILE */}
            <Link href="/dashboard" className="flex items-center gap-2 lg:hidden" aria-label="CSRoma – Dashboard">
              <div className="relative h-8 w-8">
                <Image src="/images/logo_CSRoma.png" alt="CSRoma" fill className="object-contain select-none" sizes="32px" priority />
              </div>
            </Link>

            {/* LOGO DESKTOP */}
            <Link href="/dashboard" className="hidden lg:flex items-center gap-3" aria-label="CSRoma – Dashboard">
              <div className="relative h-16 w-16 xl:h-20 xl:w-20">
                <Image src="/images/logo_CSRoma.svg" alt="CSRoma" fill className="object-contain select-none" sizes="(max-width: 1280px) 40px, 48px" priority />
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
            <button type="button" onClick={handleSignOut} className="cs-btn cs-btn--primary">Esci</button>

            <div className="flex items-center gap-3 rounded-full border border-[color:var(--cs-border)] bg-[color:var(--cs-surface)] px-3 py-1.5 text-left shadow-sm">
              <div className="cs-avatar cs-bg-primary">
                <span className="text-sm font-semibold">{initials}</span>
              </div>
              <div className="hidden sm:block">
                <p className="text-sm font-semibold text-[color:var(--cs-text)]">
                  {`${first ?? ''} ${last ?? ''}`.trim() || user?.email || 'Utente CSRoma'}
                </p>
                {!!roleLabel && <p className="text-xs text-[color:var(--cs-text-secondary)]">{roleLabel}</p>}
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="cs-layout">
        <aside className="cs-sidebar">
          <RoleSidebar />
        </aside>
        <main className="cs-main">{children}</main>
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
                <p className="text-sm font-semibold text-[color:var(--cs-text)]">
                  {`${first ?? ''} ${last ?? ''}`.trim() || user?.email || 'Utente CSRoma'}
                </p>
                {!!roleLabel && <p className="text-xs text-[color:var(--cs-text-secondary)]">{roleLabel}</p>}
                <button type="button" onClick={async () => { setMobileMenuOpen(false); await handleSignOut() }} className="cs-btn cs-btn--primary cs-btn--block mt-3">
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
    case 'admin': return 'Amministratore'
    case 'coach': return 'Allenatore'
    case 'athlete': return 'Atleta'
    default: return 'Utente CSRoma'
  }
}
