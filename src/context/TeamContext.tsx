'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { SUBJECT_CONTEXT_CHANGED_EVENT, type SubjectContextChangedDetail, useAccessibleProfiles } from './AccessibleProfileContext'
import { useAuthOptional } from '@/hooks/useAuth'

export type TeamOption = {
  id: string
  name: string
  code?: string | null
  activity?: string | null
}

type TeamContextValue = {
  teams: TeamOption[]
  selectedTeamId: string | null
  selectedTeam: TeamOption | null
  setTeams: (teams: TeamOption[]) => void
  setSelectedTeamId: (teamId: string | null) => void
  resetTeam: () => void
}

const TeamContext = createContext<TeamContextValue | null>(null)
const STORAGE_PREFIX = 'csroma_team_context'

function storageKey(area: string, subjectId: string | null) {
  return `${STORAGE_PREFIX}:${area}:${subjectId ?? 'self'}`
}

export function TeamProvider({ children }: { children: React.ReactNode }) {
  const { selectedProfileId, activeArea } = useAccessibleProfiles()
  const auth = useAuthOptional()
  const role = auth?.role
  const account = auth?.account
  const [teams, setTeamsState] = useState<TeamOption[]>([])
  const [selectedTeamId, setSelectedTeamIdState] = useState<string | null>(null)
  const contextKey = storageKey(activeArea, selectedProfileId)
  const previousContextKey = useRef(contextKey)
  const initialized = useRef(false)

  useEffect(() => {
    const resetForSubjectChange = (event: Event) => {
      const detail = (event as CustomEvent<SubjectContextChangedDetail>).detail
      setTeamsState([])
      setSelectedTeamIdState(null)
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(contextKey)
        window.localStorage.removeItem(storageKey(activeArea, detail?.subjectProfileId ?? null))
      }
    }
    window.addEventListener(SUBJECT_CONTEXT_CHANGED_EVENT, resetForSubjectChange)
    return () => window.removeEventListener(SUBJECT_CONTEXT_CHANGED_EVENT, resetForSubjectChange)
  }, [activeArea, contextKey])

  useEffect(() => {
    if (previousContextKey.current !== contextKey) {
      previousContextKey.current = contextKey
      setTeamsState([])
      setSelectedTeamIdState(null)
      if (typeof window !== 'undefined') window.localStorage.removeItem(contextKey)
      return
    }
    if (initialized.current) return
    initialized.current = true
    if (typeof window === 'undefined') return
    setSelectedTeamIdState(window.localStorage.getItem(contextKey))
  }, [contextKey])

  const setTeams = useCallback((nextTeams: TeamOption[]) => {
    const uniqueTeams = Array.from(new Map(nextTeams.filter((team) => team.id).map((team) => [team.id, team])).values())
    setTeamsState(uniqueTeams)
    setSelectedTeamIdState((current) => {
      if (!current || uniqueTeams.some((team) => team.id === current)) return current
      if (typeof window !== 'undefined') window.localStorage.removeItem(contextKey)
      return null
    })
  }, [contextKey])

  useEffect(() => {
    if (role !== 'coach' || !account?.ownerProfileId) return
    const controller = new AbortController()
    void fetch('/api/coach/teams', { signal: controller.signal, cache: 'no-store', headers: { Accept: 'application/json' } })
      .then(async (response) => {
        if (!response.ok) return
        const payload = await response.json() as { teams?: TeamOption[] }
        if (!controller.signal.aborted) setTeams(payload.teams ?? [])
      })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === 'AbortError')) setTeams([])
      })
    return () => controller.abort()
  }, [account?.ownerProfileId, role, setTeams])

  const setSelectedTeamId = useCallback((teamId: string | null) => {
    if (teamId && !teams.some((team) => team.id === teamId)) return
    setSelectedTeamIdState(teamId)
    if (typeof window === 'undefined') return
    if (teamId) window.localStorage.setItem(contextKey, teamId)
    else window.localStorage.removeItem(contextKey)
  }, [contextKey, teams])

  const resetTeam = useCallback(() => {
    setSelectedTeamIdState(null)
    if (typeof window !== 'undefined') window.localStorage.removeItem(contextKey)
  }, [contextKey])
  const selectedTeam = useMemo(() => teams.find((team) => team.id === selectedTeamId) ?? null, [selectedTeamId, teams])
  const value = useMemo(() => ({ teams, selectedTeamId, selectedTeam, setTeams, setSelectedTeamId, resetTeam }), [resetTeam, selectedTeam, selectedTeamId, setSelectedTeamId, setTeams, teams])

  return <TeamContext.Provider value={value}>{children}</TeamContext.Provider>
}

export function useTeamContext() {
  const context = useContext(TeamContext)
  if (!context) throw new Error('useTeamContext deve essere utilizzato dentro TeamProvider')
  return context
}
