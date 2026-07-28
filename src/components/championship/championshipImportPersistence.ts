interface SupabaseLike {
  from: (table: string) => any
}

interface ImportedMatch {
  championship_group_id: string
  match_day: number | null
  match_date: string | null
  start_time: string | null
  location_text: string | null
  notes: string | null
  home_club_team_id: string
  away_club_team_id: string
  source: string
  status: string
}

export async function persistImportedMatches(
  supabase: SupabaseLike,
  matches: ImportedMatch[],
  groupClubTeamIds: Set<string>
) {
  const { error } = await supabase
    .from('championship_matches')
    .upsert(matches, { onConflict: 'championship_group_id,match_day,home_club_team_id,away_club_team_id' })
  if (error) throw error

  if (groupClubTeamIds.size > 0) {
    const { error: groupTeamsError } = await supabase
      .from('championship_group_teams')
      .upsert(Array.from(groupClubTeamIds).map((clubTeamId) => ({
        championship_group_id: matches[0].championship_group_id,
        championship_club_team_id: clubTeamId,
      })), { onConflict: 'championship_group_id,championship_club_team_id' })
    if (groupTeamsError) throw groupTeamsError
  }
}

interface ImportedResult {
  matchId: string
  sets: { home: number; away: number }[]
}

export async function persistImportedResults(supabase: SupabaseLike, results: ImportedResult[]) {
  for (const result of results) {
    const { error: deleteError } = await supabase
      .from('championship_match_sets')
      .delete()
      .eq('match_id', result.matchId)
    if (deleteError) throw deleteError

    if (result.sets.length > 0) {
      const { error: insertError } = await supabase
        .from('championship_match_sets')
        .insert(result.sets.map((set, index) => ({
          match_id: result.matchId,
          set_number: index + 1,
          home_points: set.home,
          away_points: set.away,
        })))
      if (insertError) throw insertError
    }

    const { error: statusError } = await supabase
      .from('championship_matches')
      .update({ status: result.sets.length > 0 ? 'completed' : 'scheduled' })
      .eq('id', result.matchId)
    if (statusError) throw statusError
  }
}
