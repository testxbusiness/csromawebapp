export type RolloverSeason = {
  id: string
  name: string
  start_date: string
  end_date: string
  is_active: boolean
}

export type RolloverSeasonContext = {
  source: RolloverSeason | null
  targets: RolloverSeason[]
  defaultTarget: RolloverSeason | null
}

function yearFromDate(value: string): string | null {
  const match = /^(\d{4})/.exec(value)
  return match ? match[1] : null
}

export function getRolloverSeasonContext(seasons: RolloverSeason[]): RolloverSeasonContext {
  const activeSeasons = seasons.filter((season) => season.is_active)
  const source = activeSeasons.length === 1 ? activeSeasons[0] : null
  const targets = source
    ? seasons
      .filter((season) => !season.is_active && season.start_date > source.end_date)
      .sort((first, second) => first.start_date.localeCompare(second.start_date))
    : []

  return { source, targets, defaultTarget: targets[0] ?? null }
}

export function getRolloverTeamCodeSuffix(target: Pick<RolloverSeason, 'start_date' | 'end_date'>): string {
  const startYear = yearFromDate(target.start_date)
  const endYear = yearFromDate(target.end_date)
  return startYear && endYear ? `${startYear.slice(-2)}${endYear.slice(-2)}` : ''
}

export function getProposedRolloverTeamCode(sourceCode: string, target: Pick<RolloverSeason, 'start_date' | 'end_date'>): string {
  const suffix = getRolloverTeamCodeSuffix(target)
  return suffix ? `${sourceCode}-${suffix}`.slice(0, 50) : sourceCode.slice(0, 50)
}
