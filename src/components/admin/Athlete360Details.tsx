'use client'

import { useEffect, useMemo, useState } from 'react'
import DetailsDrawer from '@/components/shared/DetailsDrawer'
import { getCertificateStatus } from '@/lib/admin/certificate-status'
import { summarizeAthletePlans } from '@/server/admin/athlete-detail'
import type { AthleteWithDetails } from './athleteTypes'

type DetailResponse = {
  athlete: {
    first_name: string; last_name: string; email: string | null; phone: string | null; birth_date: string | null
    membership_number: string | null; medical_certificate_expiry: string | null
  }
  season: { id: string; name: string }
  account: { status: string } | null
  enrollment_application_delivered: boolean
  teams: Array<{ id: string; name: string; code: string; activity_name: string; jersey_number: string | null; status: string }>
  plans: Array<{
    id: string; name: string | null; team_id: string; team_name: string; activity_id: string; activity_name: string
    installments: Array<{ id: string; installment_number: number; due_date: string; amount: number; status: string; paid_at: string | null }>
  }>
}

type Props = {
  open: boolean
  athlete: AthleteWithDetails | null
  seasonId: string
  onClose: () => void
  onEdit: (athlete: AthleteWithDetails) => void
}

const money = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' })
const date = (value: string | null | undefined) => value ? new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString('it-IT') : '—'

function installmentStatus(status: string, paidAt: string | null, dueDate: string) {
  if (paidAt) return { label: 'Pagata', tone: 'success' }
  if (status === 'partially_paid') return { label: 'Parzialmente pagata', tone: 'warning' }
  if (status === 'overdue' || dueDate < new Date().toISOString().slice(0, 10)) return { label: 'Scaduta', tone: 'danger' }
  if (status === 'due_soon') return { label: 'In scadenza', tone: 'warning' }
  return { label: 'Da pagare', tone: 'neutral' }
}

export default function Athlete360Details({ open, athlete, seasonId, onClose, onEdit }: Props) {
  const [data, setData] = useState<DetailResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !athlete || !seasonId || seasonId === 'all') {
      setData(null)
      setError(null)
      return
    }
    const controller = new AbortController()
    setData(null)
    setError(null)
    setLoading(true)
    fetch(`/api/admin/athletes/${encodeURIComponent(athlete.id)}/details?seasonId=${encodeURIComponent(seasonId)}`, { signal: controller.signal })
      .then(async (response) => {
        const body = await response.json()
        if (!response.ok) throw new Error(body.error || 'Impossibile caricare il dettaglio atleta')
        return body as DetailResponse
      })
      .then(setData)
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Errore di rete durante il caricamento')
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [open, athlete, seasonId])

  const totals = useMemo(() => summarizeAthletePlans((data?.plans ?? []).map((plan) => ({
    id: plan.id,
    name: plan.name,
    teamId: plan.team_id,
    teamName: plan.team_name,
    activityId: plan.activity_id,
    activityName: plan.activity_name,
    installments: plan.installments,
  }))), [data?.plans])
  const certificateStatus = data?.athlete.medical_certificate_expiry
    ? getCertificateStatus(data.athlete.medical_certificate_expiry)
    : 'missing'

  return (
    <DetailsDrawer
      open={open}
      onClose={onClose}
      title={data ? `${data.athlete.first_name} ${data.athlete.last_name}` : 'Dettaglio Atleta'}
      size="xl"
      footer={athlete && <button className="cs-btn cs-btn--outline" onClick={() => onEdit(athlete)}>Modifica anagrafica</button>}
    >
      {loading ? (
        <div role="status" aria-live="polite" className="space-y-4 py-4">
          <span className="sr-only">Caricamento dettaglio atleta…</span>
          <div className="cs-skeleton h-8 w-1/2" /><div className="cs-skeleton h-24 w-full" /><div className="cs-skeleton h-36 w-full" />
        </div>
      ) : error ? (
        <div role="alert" className="cs-card p-5"><p className="font-semibold">Dettaglio non disponibile</p><p className="text-secondary mt-1">{error}</p></div>
      ) : !data ? (
        <p className="text-secondary py-4">Seleziona una stagione specifica per consultare il dettaglio atleta.</p>
      ) : (
        <div className="space-y-5">
          <section aria-labelledby="athlete-identity-heading" className="cs-card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm text-secondary">{data.season.name}</p>
                <h3 id="athlete-identity-heading" className="text-xl font-semibold mt-1">{data.athlete.first_name} {data.athlete.last_name}</h3>
                <p className="text-sm text-secondary mt-1">{data.athlete.email || 'Email non disponibile'}{data.athlete.phone ? ` · ${data.athlete.phone}` : ''}</p>
              </div>
              <span className={`cs-badge ${data.account?.status === 'active' ? 'cs-badge--success' : 'cs-badge--neutral'}`}>
                {data.account ? `Account ${data.account.status === 'active' ? 'attivo' : data.account.status}` : 'Senza account'}
              </span>
            </div>
            <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-5 text-sm">
              <div><dt className="text-secondary">Data di nascita</dt><dd className="font-medium mt-1">{date(data.athlete.birth_date)}</dd></div>
              <div><dt className="text-secondary">Numero tessera</dt><dd className="font-medium mt-1">{data.athlete.membership_number || 'Non registrato'}</dd></div>
              <div><dt className="text-secondary">Domanda iscrizione</dt><dd className="mt-1"><span className={`cs-badge ${data.enrollment_application_delivered ? 'cs-badge--success' : 'cs-badge--warning'}`}>{data.enrollment_application_delivered ? 'Consegnata' : 'Non consegnata'}</span></dd></div>
            </dl>
          </section>

          <section aria-labelledby="athlete-finance-heading">
            <div className="flex items-center justify-between gap-3 mb-3">
              <h3 id="athlete-finance-heading" className="font-semibold">Situazione economica</h3>
              {totals.hasMultiplePlansPerActivity && <span className="cs-badge cs-badge--warning">Più piani nella stessa attività</span>}
            </div>
            {data.plans.length === 0 ? (
              <div className="cs-card p-5 text-secondary">Nessuna quota assegnata rilevata</div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[['Totale dovuto', totals.totalDue], ['Pagato', totals.totalPaid], ['Residuo', totals.remaining]].map(([label, value]) => (
                    <div className="cs-card p-4" key={String(label)}><p className="text-sm text-secondary">{label}</p><p className="text-xl font-semibold mt-1">{money.format(Number(value))}</p></div>
                  ))}
                </div>
                <div className="space-y-3 mt-3">
                  {data.plans.map((plan) => {
                    const planTotal = plan.installments.reduce((sum, installment) => sum + installment.amount, 0)
                    const planPaid = plan.installments.reduce((sum, installment) => sum + (installment.paid_at ? installment.amount : 0), 0)
                    const next = plan.installments.find((installment) => !installment.paid_at && installment.due_date >= new Date().toISOString().slice(0, 10))
                    return <div className="cs-card p-4" key={plan.id}>
                      <div className="flex flex-wrap justify-between gap-3">
                        <div><h4 className="font-semibold">{plan.activity_name}</h4><p className="text-sm text-secondary">{plan.team_name} · {plan.name || 'Nome piano non disponibile'}</p></div>
                        <p className="text-sm font-medium">{money.format(planTotal)} <span className="text-secondary font-normal">emesso</span></p>
                      </div>
                      <p className="text-sm text-secondary mt-2">Pagato {money.format(planPaid)} · Residuo {money.format(planTotal - planPaid)} · {plan.installments.length} rate{next ? ` · prossima ${date(next.due_date)}` : ''}</p>
                      <details className="mt-3">
                        <summary className="cursor-pointer text-sm font-medium">Dettaglio rate</summary>
                        <ul className="divide-y mt-2">
                          {plan.installments.map((installment) => {
                            const status = installmentStatus(installment.status, installment.paid_at, installment.due_date)
                            return <li key={installment.id} className="py-3 flex flex-wrap items-center justify-between gap-2 text-sm">
                              <span>Rata {installment.installment_number} · {date(installment.due_date)}</span>
                              <span className="flex items-center gap-2"><strong>{money.format(installment.amount)}</strong><span className={`cs-badge cs-badge--${status.tone}`}>{status.label}</span></span>
                            </li>
                          })}
                        </ul>
                        {plan.installments.some((installment) => installment.status === 'partially_paid') && <p className="text-xs text-secondary mt-2">Il sistema non registra l’importo parziale: il residuo resta calcolato sull’intera rata.</p>}
                      </details>
                    </div>
                  })}
                </div>
              </>
            )}
          </section>

          <section aria-labelledby="athlete-teams-heading" className="cs-card p-5">
            <h3 id="athlete-teams-heading" className="font-semibold mb-3">Attività e squadre</h3>
            {data.teams.length ? <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">{data.teams.map((team) => <li key={team.id} className="border rounded-lg p-3"><p className="font-medium">{team.name}{team.jersey_number ? ` · #${team.jersey_number}` : ''}</p><p className="text-sm text-secondary">{team.activity_name} · {team.status}</p></li>)}</ul> : <p className="text-sm text-secondary">Nessuna squadra associata in questa stagione.</p>}
          </section>

          <section aria-labelledby="athlete-documents-heading" className="cs-card p-5">
            <h3 id="athlete-documents-heading" className="font-semibold mb-3">Documentazione</h3>
            <div className="flex flex-wrap justify-between gap-3 border-b pb-3"><div><p className="font-medium">Certificato medico</p><p className="text-sm text-secondary">{certificateStatus === 'missing' ? 'Non consegnato' : `Scadenza ${date(data.athlete.medical_certificate_expiry)}`}</p></div><span className={`cs-badge ${certificateStatus === 'expired' ? 'cs-badge--danger' : certificateStatus === 'valid' ? 'cs-badge--success' : 'cs-badge--warning'}`}>{certificateStatus === 'expired' ? 'Scaduto' : certificateStatus === 'valid' ? 'Valido' : certificateStatus === 'expiring' ? 'In scadenza' : 'Dato mancante'}</span></div>
            {certificateStatus === 'missing' && <p className="text-xs text-secondary mt-2">Il modello registra la scadenza, ma non conserva uno stato di consegna separato.</p>}
          </section>
        </div>
      )}
    </DetailsDrawer>
  )
}
