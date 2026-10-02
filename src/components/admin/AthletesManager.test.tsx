import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import AthletesManager from './AthletesManager'
import { createClient } from '@/lib/supabase/client'

jest.mock('@/lib/supabase/client', () => ({ createClient: jest.fn() }))
jest.mock('./AdminModal', () => ({
  __esModule: true,
  default: ({ isOpen, title, children, footer }: { isOpen: boolean; title: string; children: React.ReactNode; footer?: React.ReactNode }) => isOpen ? <div role="dialog" aria-label={title}>{children}{footer}</div> : null,
}))
jest.mock('./TeamAssignmentModal', () => ({ __esModule: true, default: () => null }))
jest.mock('./AthleteImportModal', () => ({ __esModule: true, default: () => null }))
jest.mock('./CollaboratorAccountActions', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/shared/DetailsDrawer', () => ({ __esModule: true, default: () => null }))

const createClientMock = createClient as jest.MockedFunction<typeof createClient>
const season = { id: '11111111-1111-4111-8111-111111111111', name: 'Stagione 2026/2027', start_date: '2026-09-01', end_date: '2027-06-30', is_active: true }
const historicalSeason = { id: '33333333-3333-4333-8333-333333333333', name: 'Stagione 2025/2026', start_date: '2025-09-01', end_date: '2026-06-30', is_active: false }
const athlete = {
  id: '22222222-2222-4222-8222-222222222222',
  first_name: 'Giulia',
  last_name: 'Bianchi',
  email: 'giulia@example.test',
  membership_number: 'A-12',
  medical_certificate_expiry: null,
  personal_notes: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  season_ids: [season.id],
  enrollment_application_delivered: false,
  teams: [],
  account: null,
}

function response(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response
}

function setup() {
  const order = (table: string) => jest.fn().mockResolvedValue({
    data: table === 'seasons' ? [season] : [],
    error: null,
  })
  const from = jest.fn((table: string) => ({ select: jest.fn().mockReturnValue({ order: order(table) }) }))
  createClientMock.mockReturnValue({ from } as unknown as ReturnType<typeof createClient>)
  global.fetch = jest.fn().mockResolvedValue(response({ athletes: [athlete] })) as jest.MockedFunction<typeof fetch>
}

describe('AthletesManager enrollment application controls', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    setup()
  })

  it('filters athletes by delivered and pending enrollment application status', async () => {
    render(<AthletesManager embedded />)
    await screen.findAllByText('Giulia Bianchi')

    fireEvent.change(screen.getByLabelText('Domanda di iscrizione'), { target: { value: 'delivered' } })
    await waitFor(() => expect(screen.queryAllByText('Giulia Bianchi')).toHaveLength(0))

    fireEvent.change(screen.getByLabelText('Domanda di iscrizione'), { target: { value: 'pending' } })
    expect(await screen.findAllByText('Giulia Bianchi')).not.toHaveLength(0)
  })

  it('sends the single delivered toggle with the selected season', async () => {
    render(<AthletesManager embedded />)
    await screen.findAllByText('Giulia Bianchi')

    fireEvent.click(screen.getAllByRole('button', { name: 'Modifica' })[0])
    fireEvent.change(screen.getByLabelText('Domanda di iscrizione consegnata'), { target: { value: 'yes' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salva modifiche' }))

    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/admin/athletes', expect.objectContaining({ method: 'PATCH' })))
    const patchCall = (global.fetch as jest.Mock).mock.calls.find((call) => call[1]?.method === 'PATCH')
    expect(JSON.parse(patchCall[1].body)).toMatchObject({
      id: athlete.id,
      season_id: season.id,
      enrollment_application_delivered: true,
    })
  })

  it('marks selected enrollment applications as delivered from the shared bulk operations modal', async () => {
    render(<AthletesManager embedded />)
    await screen.findAllByText('Giulia Bianchi')
    fireEvent.click(screen.getAllByRole('checkbox').at(-1)!)
    fireEvent.click(screen.getByRole('button', { name: 'Operazioni Massive' }))
    fireEvent.change(screen.getByLabelText('Tipo di Operazione'), {
      target: { value: 'set_enrollment_application_delivered' },
    })

    expect(screen.getByRole('dialog', { name: 'Operazione Massiva - 1 atleti selezionati' })).toHaveTextContent('domanda di iscrizione sarà segnata come consegnata per 1 atleta nella stagione Stagione 2026/2027')
    expect(screen.queryByText(/Eventuali correzioni/i)).not.toBeInTheDocument()
    expect(screen.queryByText('Segna non consegnata')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Conferma domanda' }))

    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/admin/athletes/bulk', expect.objectContaining({ method: 'POST' })))
    const bulkCall = (global.fetch as jest.Mock).mock.calls.find((call) => call[0] === '/api/admin/athletes/bulk')
    expect(JSON.parse(bulkCall[1].body)).toEqual({
      operation: 'set_enrollment_application_delivered',
      athleteIds: [athlete.id],
      parameters: { seasonId: season.id, delivered: true },
    })
  })

  it('keeps the enrollment status isolated when switching the same athlete to a historical season', async () => {
    const order = (table: string) => jest.fn().mockResolvedValue({
      data: table === 'seasons' ? [season, historicalSeason] : [],
      error: null,
    })
    createClientMock.mockReturnValue({
      from: jest.fn((table: string) => ({ select: jest.fn().mockReturnValue({ order: order(table) }) })),
    } as unknown as ReturnType<typeof createClient>)
    global.fetch = jest.fn((input: RequestInfo | URL) => {
      const url = String(input)
      const historical = url.includes(`seasonId=${historicalSeason.id}`)
      return Promise.resolve(response({ athletes: [{ ...athlete, season_ids: [historical ? historicalSeason.id : season.id], enrollment_application_delivered: historical }] }))
    }) as jest.MockedFunction<typeof fetch>

    render(<AthletesManager embedded />)
    expect(await screen.findAllByText('Da consegnare')).not.toHaveLength(0)
    fireEvent.change(screen.getByLabelText('Stagione'), { target: { value: historicalSeason.id } })

    expect(await screen.findAllByText('Consegnata')).not.toHaveLength(0)
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
      `/api/admin/athletes?seasonId=${historicalSeason.id}`,
    ))
  })
})
