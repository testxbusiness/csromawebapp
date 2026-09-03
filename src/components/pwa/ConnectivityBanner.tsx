'use client'

type ConnectivityBannerProps = {
  offline: boolean
  onlineNotice?: boolean
}

export function ConnectivityBanner({ offline, onlineNotice = false }: ConnectivityBannerProps) {
  if (!offline && !onlineNotice) return null

  return (
    <div
      className={offline ? 'cs-connectivity-banner cs-connectivity-banner--offline' : 'cs-connectivity-banner cs-connectivity-banner--online'}
      role="status"
      aria-live="polite"
    >
      {offline ? 'Sei offline. Alcuni contenuti potrebbero non essere aggiornati e le modifiche non sono disponibili.' : 'Connessione ripristinata.'}
    </div>
  )
}
