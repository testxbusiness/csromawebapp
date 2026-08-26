'use client'

type ConnectivityBannerProps = {
  offline: boolean
}

export function ConnectivityBanner({ offline }: ConnectivityBannerProps) {
  if (!offline) return null

  return (
    <div
      className="fixed inset-x-0 top-0 z-[200] border-b border-[color:var(--cs-warning)] bg-[color:var(--cs-warm)] px-4 py-2 text-center text-sm font-semibold text-slate-950 shadow-sm"
      role="status"
      aria-live="polite"
    >
      Sei offline. Le modifiche saranno disponibili quando torna la connessione.
    </div>
  )
}
