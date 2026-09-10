import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type React from 'react'
import TeamModal from './TeamModal'

jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({}),
}))

jest.mock('./TrainingScheduleInput', () => ({
  __esModule: true,
  default: () => <div data-testid="training-schedules" />,
}))

jest.mock('@/components/ui', () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h1>{children}</h1>,
}))

const baseProps = {
  open: true,
  onClose: jest.fn(),
  team: null,
  activities: [{ id: 'activity-1', name: 'Basket', seasons: { name: '2026' } }],
  coaches: [],
  gyms: [],
  onCreate: jest.fn().mockResolvedValue('team-1'),
  onUpdate: jest.fn().mockResolvedValue(undefined),
  onGenerateCode: jest.fn().mockReturnValue('BAS001'),
}

function jsonResponse(body: unknown, ok = true) {
  return Promise.resolve({ ok, json: async () => body })
}

describe('TeamModal RSVP and save contract', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    global.fetch = jest.fn().mockReturnValue(jsonResponse({ success: true, warnings: [], eventsCreated: 0, eventsUpdated: 0, eventsPreserved: 0 }))
  })

  it('creates once, passes the RSVP preference, and reconciles with the returned team id', async () => {
    render(<TeamModal {...baseProps} />)

    fireEvent.change(screen.getByPlaceholderText('Es: Under 15, Primi Calci, Squadra A…'), { target: { value: 'U15' } })
    fireEvent.change(screen.getByDisplayValue("Seleziona un'attività"), { target: { value: 'activity-1' } })
    fireEvent.change(screen.getByPlaceholderText('Es: U15C001'), { target: { value: 'U15B001' } })
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: 'Crea' }))

    await waitFor(() => expect(baseProps.onCreate).toHaveBeenCalledTimes(1))
    expect(baseProps.onCreate).toHaveBeenCalledWith(expect.objectContaining({ training_rsvp_enabled: true }))
    expect(baseProps.onUpdate).not.toHaveBeenCalled()
    expect(global.fetch).toHaveBeenCalledWith('/api/admin/training-schedules', expect.objectContaining({
      body: JSON.stringify({ team_id: 'team-1', schedules: [] }),
    }))
  })

  it('keeps the form open after reconciliation failure and retries with update', async () => {
    const onCreate = jest.fn().mockResolvedValue('team-1')
    const onUpdate = jest.fn().mockResolvedValue(undefined)
    const fetchMock = global.fetch as jest.Mock
    fetchMock
      .mockReturnValueOnce(jsonResponse({ success: false, error: 'Generazione non riuscita' }, false))
      .mockReturnValueOnce(jsonResponse({ success: true, warnings: [], eventsCreated: 0, eventsUpdated: 0, eventsPreserved: 0 }))

    render(<TeamModal {...baseProps} onCreate={onCreate} onUpdate={onUpdate} />)
    fireEvent.change(screen.getByPlaceholderText('Es: Under 15, Primi Calci, Squadra A…'), { target: { value: 'U15' } })
    fireEvent.change(screen.getByDisplayValue("Seleziona un'attività"), { target: { value: 'activity-1' } })
    fireEvent.change(screen.getByPlaceholderText('Es: U15C001'), { target: { value: 'U15B001' } })

    fireEvent.click(screen.getByRole('button', { name: 'Crea' }))
    await screen.findByRole('alert')
    expect(baseProps.onClose).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Crea' }))
    await waitFor(() => expect(onUpdate).toHaveBeenCalledWith('team-1', expect.anything()))
    expect(onCreate).toHaveBeenCalledTimes(1)
  })

  it('exposes the saved preference and keeps submit loading while the save is pending', async () => {
    let resolveCreate: ((id: string) => void) | undefined
    const onCreate = jest.fn(() => new Promise<string>((resolve) => { resolveCreate = resolve }))
    const { rerender } = render(<TeamModal {...baseProps} onCreate={onCreate} />)

    fireEvent.change(screen.getByLabelText('Nome Squadra *'), { target: { value: 'U15' } })
    fireEvent.change(screen.getByLabelText('Attività *'), { target: { value: 'activity-1' } })
    fireEvent.change(screen.getByLabelText('Codice Squadra *'), { target: { value: 'U15B001' } })
    fireEvent.keyDown(screen.getByRole('checkbox'), { key: ' ' })
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: 'Crea' }))

    await waitFor(() => expect(screen.getByRole('button', { name: 'Salvataggio…' })).toBeDisabled())
    resolveCreate?.('team-1')
    await waitFor(() => expect(baseProps.onClose).toHaveBeenCalled())

    rerender(<TeamModal {...baseProps} team={{ id: 'team-1', name: 'U15', code: 'U15B001', activity_id: 'activity-1', training_rsvp_enabled: true }} />)
    await waitFor(() => expect(screen.getByRole('checkbox')).toBeChecked())
  })
})
