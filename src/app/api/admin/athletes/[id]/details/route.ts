import { NextResponse } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { AccountContextError } from '@/server/auth/require-account-context'
import { requireGlobalRole } from '@/server/auth/require-global-role'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(request: Request, { params }: RouteContext) {
  try {
    const client = await createClient()
    await requireGlobalRole(client, 'admin')
    const { id } = await params
    const seasonId = new URL(request.url).searchParams.get('seasonId')
    if (!seasonId) return NextResponse.json({ error: 'Stagione richiesta' }, { status: 400 })

    const admin = createAdminClient()
    const [{ data: profile, error: profileError }, { data: athleteProfile, error: athleteError }, { data: seasonProfile, error: seasonProfileError }] = await Promise.all([
      admin.from('profiles').select('id, first_name, last_name, email, phone, birth_date').eq('id', id).maybeSingle(),
      admin.from('athlete_profiles').select('membership_number, medical_certificate_expiry').eq('profile_id', id).maybeSingle(),
      admin.from('season_profiles').select('enrollment_application_delivered').eq('profile_id', id).eq('season_id', seasonId).maybeSingle(),
    ])

    if (profileError || athleteError || seasonProfileError) {
      console.error('Errore caricamento dettaglio atleta:', profileError || athleteError || seasonProfileError)
      return NextResponse.json({ error: 'Impossibile caricare il dettaglio atleta' }, { status: 500 })
    }
    if (!profile || !athleteProfile || !seasonProfile) return NextResponse.json({ error: 'Atleta non trovato nella stagione selezionata' }, { status: 404 })

    const [{ data: season }, { data: account }, { data: memberships, error: membershipsError }, { data: rawInstallments, error: installmentsError }] = await Promise.all([
      admin.from('seasons').select('id, name').eq('id', seasonId).maybeSingle(),
      admin.from('app_accounts').select('auth_user_id, status').eq('owner_profile_id', id).maybeSingle(),
      admin.from('team_members').select('jersey_number, role, teams(id, name, code, activity_id, activities(id, name, season_id))').eq('profile_id', id),
      admin.from('fee_installments').select('id, installment_number, due_date, amount, status, paid_at, membership_fees(id, name, team_id, teams(id, name, activity_id, activities(id, name, season_id)))').eq('profile_id', id).order('due_date', { ascending: true }),
    ])

    if (membershipsError || installmentsError) {
      console.error('Errore caricamento squadre/rate dettaglio atleta:', membershipsError || installmentsError)
      return NextResponse.json({ error: 'Impossibile caricare squadre e rate' }, { status: 500 })
    }
    if (!season) return NextResponse.json({ error: 'Stagione non trovata' }, { status: 404 })

    const seasonTeams = (memberships ?? []).flatMap((membership) => {
      const team = Array.isArray(membership.teams) ? membership.teams[0] : membership.teams
      if (!team) return []
      const activity = Array.isArray(team.activities) ? team.activities[0] : team.activities
      if (!activity || activity.season_id !== seasonId || membership.role !== 'athlete') return []
      return [{ id: team.id, name: team.name, code: team.code, activity_name: activity.name, jersey_number: membership.jersey_number, status: 'Attiva' }]
    })

    type PlanDetail = {
      id: string; name: string | null; team_id: string; team_name: string; activity_id: string; activity_name: string;
      installments: Array<{ id: string; installment_number: number; due_date: string; amount: number; status: string; paid_at: string | null }>
    }
    const plansById = new Map<string, PlanDetail>()
    for (const installment of rawInstallments ?? []) {
      const fee = Array.isArray(installment.membership_fees) ? installment.membership_fees[0] : installment.membership_fees
      const team = fee && (Array.isArray(fee.teams) ? fee.teams[0] : fee.teams)
      const activity = team && (Array.isArray(team.activities) ? team.activities[0] : team.activities)
      if (!fee || !team || !activity || activity.season_id !== seasonId) continue
      const plan: PlanDetail = plansById.get(fee.id) ?? {
        id: fee.id, name: fee.name, team_id: team.id, team_name: team.name,
        activity_id: activity.id, activity_name: activity.name, installments: [],
      }
      plan.installments.push({
        id: installment.id,
        installment_number: installment.installment_number,
        due_date: installment.due_date,
        amount: Number(installment.amount),
        status: installment.status,
        paid_at: installment.paid_at,
      })
      plansById.set(fee.id, plan)
    }

    return NextResponse.json({
      athlete: { ...profile, membership_number: athleteProfile.membership_number, medical_certificate_expiry: athleteProfile.medical_certificate_expiry },
      season,
      account: account ? { status: account.status } : null,
      enrollment_application_delivered: seasonProfile.enrollment_application_delivered,
      teams: seasonTeams,
      plans: [...plansById.values()],
    })
  } catch (error) {
    if (error instanceof AccountContextError) return NextResponse.json({ error: error.message }, { status: error.status })
    console.error('Errore API dettaglio atleta:', error)
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 })
  }
}
