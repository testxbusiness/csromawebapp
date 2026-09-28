import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import SeasonRolloverWizard from './SeasonRolloverWizard'

const historicalSeason = { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', name: 'Stagione 2025/2026', start_date: '2025-09-01', end_date: '2026-06-30', is_active: false }
const sourceSeason = { id: '11111111-1111-4111-8111-111111111111', name: 'Stagione 2026/2027', start_date: '2026-09-01', end_date: '2027-06-30', is_active: true }
const targetSeason = { id: '22222222-2222-4222-8222-222222222222', name: 'Stagione 2027/2028', start_date: '2027-09-01', end_date: '2028-06-30', is_active: false }
const laterTargetSeason = { id: '77777777-7777-4777-8777-777777777777', name: 'Stagione 2028/2029', start_date: '2028-09-01', end_date: '2029-06-30', is_active: false }
const profileId = '33333333-3333-4333-8333-333333333333'
const sourceTeamId = '44444444-4444-4444-8444-444444444444'
const targetTeamId = '55555555-5555-4555-8555-555555555555'

function response(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response
}

const structurePreview = { gyms: [{ source: { id: sourceTeamId, name: 'Palestra Test' }, matches: [], mappedTargetId: null }], activities: [{ source: { id: sourceTeamId, name: 'Basket Test' }, matches: [], mappedTargetId: null }] }
const teamPreview = { teams: [{ source: { id: sourceTeamId, name: 'U16 Test', code: 'U16', activity_id: sourceTeamId, activity: { id: sourceTeamId, name: 'Basket Test', season_id: sourceSeason.id } }, mappedActivity: { id: targetTeamId, name: 'Basket Test', season_id: targetSeason.id }, targetMatches: [], mappedTargetId: null, proposedCode: 'U16-2728' }], targetTeams: [] }
const profile = { profile: { id: profileId, firstName: 'Luca', lastName: 'Rossi' }, category: 'athlete' as const, status: 'active', sourceTeams: [{ id: sourceTeamId, name: 'U16 Test', code: 'U16', jerseyNumber: 8, role: 'athlete' }], targetTeams: [{ id: targetTeamId, name: 'U16 Test 2027', code: 'U16-2728', sourceTeamId }], target: { enrolled: false, status: null, teamIds: [] }, family: [{ relationshipType: 'parent', permissions: ['view_schedule'] }], warnings: [] }
const rolloverSeasons = [historicalSeason, sourceSeason, targetSeason]

describe('SeasonRolloverWizard', () => {
  beforeEach(() => {
    global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/season-structures') && !init) return Promise.resolve(response(structurePreview))
      if (url.includes('/season-teams') && !init) return Promise.resolve(response(teamPreview))
      if (url.includes('/season-profiles')) return Promise.resolve(response({ sourceSeason: {}, targetSeason: {}, athletes: [profile], collaborators: [] }))
      if (url.includes('/season-profile-batch')) return Promise.resolve(response({ batchKey: '66666666-6666-4666-8666-666666666666', included: 1, excluded: 0, withoutTeam: 0, teamMembers: 1, teamCoaches: 0, warnings: 0, replayed: false }))
      return Promise.resolve(response({}))
    }) as jest.MockedFunction<typeof fetch>
  })

  it('keeps profiles opt-in and sends the visible assignment summary', async () => {
    render(<SeasonRolloverWizard seasons={rolloverSeasons} onClose={jest.fn()} onCompleted={jest.fn()} />)
    expect(screen.getByRole('heading', { name: 'Rollover profili verso Stagione 2027/2028' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Continua' }))
    await screen.findByText('Palestra Test')
    fireEvent.change(screen.getByLabelText('Scelta Palestre Palestra Test'), { target: { value: 'copy' } })
    fireEvent.click(screen.getByRole('button', { name: 'Continua' }))
    await screen.findByText('U16 Test')
    fireEvent.change(screen.getByLabelText('Scelta squadra U16 Test'), { target: { value: 'create' } })
    fireEvent.click(screen.getByRole('button', { name: 'Continua' }))
    await screen.findByText('Luca Rossi')
    expect(screen.getByText('Non portare')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Includi risultati (1)' }))
    fireEvent.click(screen.getByRole('button', { name: 'Continua' }))
    await screen.findByText('Assegnazioni target')
    const assignment = screen.getByRole('checkbox', { name: /U16 Test 2027/ })
    expect(assignment).toBeChecked()
    fireEvent.click(screen.getByRole('button', { name: 'Vai al riepilogo' }))
    await screen.findByText('Riepilogo e conferma')
    expect(screen.getByText('Inclusi')).toBeInTheDocument()
    expect(screen.getByText('Esclusi')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('checkbox', { name: /Confermo il riepilogo/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Conferma e salva selezioni' }))
    await waitFor(() => expect(screen.getByText('Selezione salvata')).toBeInTheDocument())
    const batchCall = (global.fetch as jest.Mock).mock.calls.find(([url]) => String(url).includes('/season-profile-batch'))
    expect(batchCall?.[1]).toEqual(expect.objectContaining({ method: 'POST' }))
    expect(JSON.parse(String(batchCall?.[1]?.body)).selections).toEqual([{ profileId, included: true, teams: [{ teamId: targetTeamId, role: 'athlete', jerseyNumber: 8 }] }])
  })

  it('filters profiles and can include the filtered result explicitly', async () => {
    render(<SeasonRolloverWizard seasons={rolloverSeasons} onClose={jest.fn()} onCompleted={jest.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Continua' }))
    await screen.findByText('Palestra Test')
    fireEvent.click(screen.getByRole('button', { name: 'Continua' }))
    await screen.findByText('U16 Test')
    fireEvent.click(screen.getByRole('button', { name: 'Continua' }))
    await screen.findByText('Luca Rossi')
    fireEvent.change(screen.getByLabelText('Cerca profilo'), { target: { value: 'inesistente' } })
    expect(screen.getByText('Nessun profilo corrisponde ai filtri')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Cerca profilo'), { target: { value: 'luca' } })
    fireEvent.click(screen.getByRole('button', { name: 'Includi risultati (1)' }))
    expect(screen.getByText('Porta nella nuova stagione')).toBeInTheDocument()
  })

  it('uses an explicitly selected future target in every preview request', async () => {
    render(<SeasonRolloverWizard seasons={[...rolloverSeasons, laterTargetSeason]} onClose={jest.fn()} onCompleted={jest.fn()} />)

    fireEvent.change(screen.getByLabelText('Target inattiva'), { target: { value: laterTargetSeason.id } })
    expect(screen.getByRole('heading', { name: 'Rollover profili verso Stagione 2028/2029' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Continua' }))

    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining(`sourceSeasonId=${sourceSeason.id}&targetSeasonId=${laterTargetSeason.id}`),
      undefined,
    ))
  })

  it('shows a server failure and retries the failed step', async () => {
    let attempts = 0
    global.fetch = jest.fn((input: RequestInfo | URL) => {
      if (String(input).includes('/season-structures')) {
        attempts += 1
        return attempts === 1 ? Promise.resolve(response({ error: 'Preview non disponibile' }, 503)) : Promise.resolve(response(structurePreview))
      }
      return Promise.resolve(response({}))
    }) as jest.MockedFunction<typeof fetch>
    render(<SeasonRolloverWizard seasons={rolloverSeasons} onClose={jest.fn()} onCompleted={jest.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Continua' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Preview non disponibile')
    fireEvent.click(screen.getByRole('button', { name: 'Riprova' }))
    expect(await screen.findByText('Palestra Test')).toBeInTheDocument()
    expect(attempts).toBe(2)
  })

  it('blocks preview requests while offline', async () => {
    Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: false })
    render(<SeasonRolloverWizard seasons={rolloverSeasons} onClose={jest.fn()} onCompleted={jest.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Continua' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Sei offline')
    Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: true })
  })
})
