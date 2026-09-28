'use client'

import Image from 'next/image'
import Link from 'next/link'
import { ArrowLeft, Menu } from 'lucide-react'
import { Button } from '@/components/ui'

export type AppHeaderVariant = 'mobile-root' | 'mobile-detail' | 'desktop' | 'family' | 'admin'
export type AppHeaderBrandTreatment = 'default' | 'athlete-dashboard'

type AppHeaderProps = {
  variant?: AppHeaderVariant
  brandTreatment?: AppHeaderBrandTreatment
  onMenuOpen?: () => void
  onBack?: () => void
  onSignOut?: () => void
  account?: React.ReactNode
  context?: React.ReactNode
  utilities?: React.ReactNode
}

export default function AppHeader({ variant = 'desktop', brandTreatment = 'default', onMenuOpen, onBack, onSignOut, account, context, utilities }: AppHeaderProps) {
  const isDetail = variant === 'mobile-detail'
  return (
    <header className={`cs-navbar cs-app-header ${variant === 'admin' ? 'cs-admin-topbar' : ''} ${brandTreatment === 'athlete-dashboard' ? 'cs-app-header--athlete-dashboard' : ''}`}>
      <div className="cs-navbar__inner cs-container">
        <div className="cs-app-header__leading">
          {isDetail ? (
            <Button variant="ghost" size="icon" className="cs-app-header__back" onClick={onBack} aria-label="Torna indietro"><ArrowLeft className="h-5 w-5" aria-hidden="true" /></Button>
          ) : (
            <Button variant="ghost" size="icon" className="lg:!hidden" onClick={onMenuOpen} aria-label="Apri navigazione"><Menu className="h-5 w-5" aria-hidden="true" /></Button>
          )}
          <Link href="/dashboard" className="cs-app-header__brand" aria-label="CSRoma – Vai alla home">
            <span className="relative h-8 w-8 lg:h-10 lg:w-10"><Image src="/images/new_csroma_logo_no_bg.svg" alt="CSRoma" fill className="object-contain select-none" sizes="40px" priority /></span>
            <span className="cs-app-header__brand-copy">
              <strong>CSRoma</strong>
              {brandTreatment === 'default' ? <small>Control Center</small> : null}
            </span>
          </Link>
          {context ? <div className="cs-app-header__context">{context}</div> : null}
        </div>
        <div className="cs-app-header__actions">
          {utilities}
          {onSignOut ? <button type="button" onClick={onSignOut} className="hidden sm:inline-flex cs-btn cs-btn--primary">Esci</button> : null}
          {account ? <div className="hidden sm:block">{account}</div> : null}
        </div>
      </div>
    </header>
  )
}
