import type { Match, MatchSet } from '@/components/championship/types'

export function formatMatchScore(sets?: MatchSet[]) {
  if (!sets || sets.length === 0) return '—'
  const home = sets.filter((set) => set.home_points > set.away_points).length
  const away = sets.filter((set) => set.home_points < set.away_points).length
  return `${home}-${away}`
}

export function formatMatchSetsDetail(sets?: MatchSet[]) {
  if (!sets || sets.length === 0) return ''
  return [...sets]
    .sort((a, b) => a.set_number - b.set_number)
    .map((set) => `${set.home_points}-${set.away_points}`)
    .join(', ')
}

export function formatChampionshipDate(value?: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('it-IT')
}

export function normalizeChampionshipTime(raw?: string | number | null) {
  if (raw === undefined || raw === null || raw === '') return null

  const numericValue = typeof raw === 'number' ? raw : Number(raw)
  if (!Number.isNaN(numericValue) && raw.toString().trim() !== '') {
    const totalSeconds = Math.round(numericValue * 24 * 3600)
    const hours = Math.floor(totalSeconds / 3600) % 24
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60
    return [hours, minutes, seconds].map((part) => part.toString().padStart(2, '0')).join(':')
  }

  const parts = raw.toString().trim().split(':')
  if (parts.length < 2) return null
  const [hours, minutes, seconds] = parts
  return `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}:${(seconds || '00').padStart(2, '0')}`
}

export function matchDateTime(match: Match) {
  if (!match.match_date) return null
  const time = match.start_time ? match.start_time.slice(0, 8) : '00:00:00'
  const date = new Date(`${match.match_date}T${time}`)
  return Number.isNaN(date.getTime()) ? null : date
}
