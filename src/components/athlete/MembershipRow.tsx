'use client'

import { ListRow } from '@/components/ui'

export type MembershipRowData = {
  id: string
  jersey_number?: number | null
  team: {
    id: string
    name: string
    code: string
    activity?: { name: string } | null
  }
  medical_certificate_expiry?: string | null
}

type MembershipRowProps = {
  membership: MembershipRowData
  readOnly?: boolean
  onOpen?: () => void
}

export function MembershipRow({ membership, readOnly = false, onOpen }: MembershipRowProps) {
  const content = (
    <>
      <span className="font-medium">{membership.team.name}</span>
      <span className="mt-1 block text-sm text-secondary">
        {membership.team.activity?.name || 'Attività non disponibile'} · {membership.team.code}
      </span>
      {membership.medical_certificate_expiry && (
        <span className="mt-1 block text-xs text-secondary">
          Certificato fino al {new Date(membership.medical_certificate_expiry).toLocaleDateString('it-IT')}
        </span>
      )}
    </>
  )
  const trailing = membership.jersey_number !== null && membership.jersey_number !== undefined
    ? <span className="font-semibold tabular-nums">#{membership.jersey_number}</span>
    : <span className="text-xs text-secondary">Numero non assegnato</span>

  if (onOpen && !readOnly) {
    return <ListRow interactive onClick={onOpen} trailing={trailing}>{content}</ListRow>
  }
  return <ListRow trailing={trailing}>{content}</ListRow>
}
