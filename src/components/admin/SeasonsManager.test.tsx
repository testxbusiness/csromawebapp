import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import SeasonsManager from './SeasonsManager'
import { createClient } from '@/lib/supabase/client'

jest.mock('@/lib/supabase/client', () => ({ createClient: jest.fn() }))
jest.mock('@/lib/utils/excelExport', () => ({ exportSeasons: jest.fn() }))
jest.mock('./SeasonsModal', () => ({
  SeasonsModal: ({ open, onSubmit, isSubmitting, error }: { open: boolean; onSubmit: (data: unknown) => void; isSubmitting?: boolean; error?: string | null }) => open ? (
    <div>
      {error ? <span role="alert">{error}</span> : null}
      <button disabled={isSubmitting} onClick={() => onSubmit({ name: 'Stagione 2026/2027', start_date: '2026-09-01', end_date: '2027-06-30', is_active: false })}>submit-season</button>
    </div>
  ) : null,
}))

const createClientMock = createClient as jest.MockedFunction<typeof createClient>
const season = { id: 'season-1', name: 'Stagione 2025/2026', start_date: '2025-09-01', end_date: '2026-06-30', is_active: true }

function setup() {
  const order = jest.fn().mockResolvedValue({ data: [season], error: null })
  const select = jest.fn().mockReturnValue({ order })
  createClientMock.mockReturnValue({ from: jest.fn().mockReturnValue({ select }) } as unknown as ReturnType<typeof createClient>)
  return { order }
}

function response(body: unknown, status: number) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response
}

describe('SeasonsManager creation flow', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    setup()
  })

  it('keeps the modal pending while the route is unresolved', async () => {
    let resolveRequest!: (response: Response) => void
    global.fetch = jest.fn((_input: RequestInfo | URL) => new Promise<Response>((resolve) => { resolveRequest = resolve })) as jest.MockedFunction<typeof fetch>
    render(<SeasonsManager embedded />)
    await screen.findAllByText('Stagione 2025/2026')
    fireEvent.click(screen.getByRole('button', { name: 'Nuova Stagione' }))
    fireEvent.click(screen.getByRole('button', { name: 'submit-season' }))
    expect(screen.getByRole('button', { name: 'submit-season' })).toBeDisabled()
    resolveRequest(response({ season }, 201))
  })

  it('keeps the modal open and shows route failures', async () => {
    global.fetch = jest.fn().mockResolvedValue(response({ error: 'Periodo sovrapposto' }, 409))
    render(<SeasonsManager embedded />)
    await screen.findAllByText('Stagione 2025/2026')
    fireEvent.click(screen.getByRole('button', { name: 'Nuova Stagione' }))
    fireEvent.click(screen.getByRole('button', { name: 'submit-season' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Periodo sovrapposto')
    expect(screen.getByRole('button', { name: 'submit-season' })).toBeInTheDocument()
  })

  it('closes the modal only after a successful response', async () => {
    global.fetch = jest.fn().mockResolvedValue(response({ season }, 201))
    render(<SeasonsManager embedded />)
    await screen.findAllByText('Stagione 2025/2026')
    fireEvent.click(screen.getByRole('button', { name: 'Nuova Stagione' }))
    fireEvent.click(screen.getByRole('button', { name: 'submit-season' }))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'submit-season' })).not.toBeInTheDocument())
  })
})
