import { ReactNode } from 'react'

export default function AuthLayout({ children }: { children: ReactNode }) {
  // Nessun wrapper: la page controlla layout, sfondo, ecc.
  return <>{children}</>
}
