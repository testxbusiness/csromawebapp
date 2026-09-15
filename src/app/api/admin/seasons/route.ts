import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { AccountContextError } from '@/server/auth/require-account-context'
import { requireGlobalRole } from '@/server/auth/require-global-role'

const TARGET_SEASON = {
  name: 'Stagione 2026/2027',
  start_date: '2026-09-01',
  end_date: '2027-06-30',
  is_active: false,
} as const

const requestSchema = z.object({
  name: z.string().trim().min(1),
  start_date: z.string().date(),
  end_date: z.string().date(),
  is_active: z.boolean(),
})

const seasonRowSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  start_date: z.string(),
  end_date: z.string(),
  is_active: z.boolean(),
  created_at: z.string().nullable().optional(),
  updated_at: z.string().nullable().optional(),
})

const seasonsResponseSchema = z.array(seasonRowSchema)

function isOverlapping(
  firstStart: string,
  firstEnd: string,
  secondStart: string,
  secondEnd: string,
): boolean {
  return firstStart <= secondEnd && secondStart <= firstEnd
}

function conflict(message: string) {
  return NextResponse.json({ error: message }, { status: 409 })
}

export async function POST(request: NextRequest) {
  try {
    const client = await createClient()
    await requireGlobalRole(client, 'admin')

    const parsed = requestSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dati della stagione non validi' }, { status: 400 })
    }

    const requested = parsed.data
    if (requested.start_date > requested.end_date) {
      return NextResponse.json({ error: 'La data di inizio non può superare la data di fine' }, { status: 400 })
    }
    if (
      requested.name !== TARGET_SEASON.name ||
      requested.start_date !== TARGET_SEASON.start_date ||
      requested.end_date !== TARGET_SEASON.end_date
    ) {
      return conflict('Nome e periodo devono corrispondere alla bozza 2026/2027')
    }
    if (requested.is_active) {
      return conflict('La bozza 2026/2027 deve essere creata inattiva')
    }

    const adminClient = createAdminClient()
    const { data, error: lookupError } = await adminClient
      .from('seasons')
      .select('id,name,start_date,end_date,is_active,created_at,updated_at')

    if (lookupError) {
      return NextResponse.json({ error: 'Impossibile verificare le stagioni esistenti' }, { status: 500 })
    }

    const seasons = seasonsResponseSchema.safeParse(data ?? [])
    if (!seasons.success) {
      return NextResponse.json({ error: 'Risposta del database non valida' }, { status: 500 })
    }

    const exactTarget = seasons.data.find((season) =>
      season.name === TARGET_SEASON.name &&
      season.start_date === TARGET_SEASON.start_date &&
      season.end_date === TARGET_SEASON.end_date,
    )
    if (exactTarget) {
      if (exactTarget.is_active) {
        return conflict('La stagione 2026/2027 esiste già come attiva')
      }
      return NextResponse.json({ season: exactTarget, created: false }, { status: 200 })
    }

    const sameNameOrPeriod = seasons.data.find((season) =>
      season.name === TARGET_SEASON.name ||
      (season.start_date === TARGET_SEASON.start_date && season.end_date === TARGET_SEASON.end_date),
    )
    if (sameNameOrPeriod) {
      return conflict('Esiste già una stagione con nome o periodo discordante')
    }

    const overlappingSeason = seasons.data.find((season) =>
      isOverlapping(TARGET_SEASON.start_date, TARGET_SEASON.end_date, season.start_date, season.end_date),
    )
    if (overlappingSeason) {
      return conflict('Il periodo 2026/2027 si sovrappone a una stagione esistente')
    }

    const { data: created, error: insertError } = await adminClient
      .from('seasons')
      .insert(TARGET_SEASON)
      .select('id,name,start_date,end_date,is_active,created_at,updated_at')
      .single()

    if (insertError) {
      return NextResponse.json({ error: 'Impossibile creare la bozza 2026/2027' }, { status: 500 })
    }

    const parsedCreated = seasonRowSchema.safeParse(created)
    if (!parsedCreated.success) {
      return NextResponse.json({ error: 'La bozza creata non ha un formato valido' }, { status: 500 })
    }

    return NextResponse.json({ season: parsedCreated.data, created: true }, { status: 201 })
  } catch (error) {
    if (error instanceof AccountContextError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    return NextResponse.json({ error: 'Impossibile creare la bozza 2026/2027' }, { status: 500 })
  }
}
