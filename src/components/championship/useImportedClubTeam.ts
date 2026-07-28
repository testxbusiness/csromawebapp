import { useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { ClubTeamOption, Team } from '@/components/championship/types'

const HOME_CLUB_CODES = new Set(['PVA1', 'PVA2', 'CSROMA', 'CS ROMA', 'CSR'])

interface UseImportedClubTeamOptions {
  championshipId: string | null
  teams: Team[]
}

interface EnsureImportedClubTeamInput {
  codeRaw: string
  nameHint?: string
  clubByCode: Map<string, ClubTeamOption>
}

export function useImportedClubTeam({ championshipId, teams }: UseImportedClubTeamOptions) {
  const supabase = useMemo(() => createClient(), [])
  const csrByCode = useMemo(() => {
    const map = new Map<string, Team>()
    teams.forEach((team) => {
      if (team.code) map.set(team.code.trim().toUpperCase(), team)
    })
    return map
  }, [teams])

  const ensureClubTeam = useCallback(async ({ codeRaw, nameHint, clubByCode }: EnsureImportedClubTeamInput) => {
    if (!championshipId) throw new Error('Campionato non selezionato')
    const code = codeRaw.trim().toUpperCase()
    if (!code) throw new Error('Codice squadra mancante')

    const csr = csrByCode.get(code)
    const existing = clubByCode.get(code)
    if (existing) {
      const shouldBeHome = !!csr || HOME_CLUB_CODES.has(code)
      const needsUpdate = (shouldBeHome && !existing.is_home_club) || (csr && existing.team_id !== csr.id)
      if (!needsUpdate) return existing.id

      const { data: updated, error } = await supabase
        .from('championship_club_teams')
        .update({
          is_home_club: shouldBeHome,
          team_id: csr?.id || existing.team_id,
          name: nameHint || existing.name,
        })
        .eq('id', existing.id)
        .select('id, code, name, is_home_club, team_id')
        .single()
      if (error) throw error

      const full: ClubTeamOption = {
        ...updated,
        teams: csr ? [{ id: csr.id, name: csr.name, code: csr.code || null }] : existing.teams,
      }
      clubByCode.set(code, full)
      return full.id
    }

    const { data: inserted, error } = await supabase
      .from('championship_club_teams')
      .insert({
        championship_id: championshipId,
        code,
        name: nameHint || csr?.name || code,
        is_home_club: !!csr || HOME_CLUB_CODES.has(code),
        team_id: csr?.id || null,
        source: 'import_excel',
      })
      .select('id, code, name, is_home_club, team_id')
      .single()
    if (error) throw error

    const full: ClubTeamOption = {
      ...inserted,
      teams: csr ? [{ id: csr.id, name: csr.name, code: csr.code || null }] : null,
    }
    clubByCode.set(code, full)
    return full.id
  }, [championshipId, csrByCode, supabase])

  return { ensureClubTeam }
}
