import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AttendanceControl, { isDeadlinePassed } from './AttendanceControl'

describe('AttendanceControl', () => {
  it('does not expose or invoke attendance mutations while offline', async () => {
    const originalOnline = navigator.onLine
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false })
    const onChange = jest.fn().mockResolvedValue(undefined)

    try {
      render(<AttendanceControl requiresConfirmation canRespond onChange={onChange} />)

      await waitFor(() => expect(screen.getByText(/sei offline/i)).toBeTruthy())
      expect(screen.queryByRole('button')).toBeNull()
      expect(onChange).not.toHaveBeenCalled()
    } finally {
      Object.defineProperty(navigator, 'onLine', { configurable: true, value: originalOnline })
    }
  })

  it('recognizes an expired deadline', () => {
    expect(isDeadlinePassed('2026-08-27T12:00:00Z', new Date('2026-08-28T12:00:00Z'))).toBe(true)
    expect(isDeadlinePassed('2026-08-29T12:00:00Z', new Date('2026-08-28T12:00:00Z'))).toBe(false)
  })

  it('is read-only for a delegated profile without confirmation permission', () => {
    render(
      <AttendanceControl
        requiresConfirmation
        canRespond={false}
        initialStatus="going"
        onChange={jest.fn()}
      />,
    )

    expect(screen.getByText(/gestita dal delegato autorizzato/i)).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('shows the expired deadline without controls', () => {
    render(
      <AttendanceControl
        requiresConfirmation
        canRespond
        confirmationDeadline="2026-08-27T12:00:00Z"
        onChange={jest.fn()}
      />,
    )

    expect(screen.getByText(/deadline superata/i)).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('does not render confirmation controls when the event does not require confirmation', () => {
    render(<AttendanceControl requiresConfirmation={false} canRespond onChange={jest.fn()} />)

    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.queryByLabelText('Conferma partecipazione')).toBeNull()
  })

  it('supports keyboard attendance selection', async () => {
    const user = userEvent.setup()
    const onChange = jest.fn().mockResolvedValue(undefined)
    render(<AttendanceControl requiresConfirmation canRespond onChange={onChange} />)

    await user.tab()
    await user.keyboard('{Enter}')

    expect(onChange).toHaveBeenCalledWith('going')
  })

  it('rolls back an optimistic response and exposes the error', async () => {
    const onChange = jest.fn().mockRejectedValue(new Error('Salvataggio non riuscito'))
    render(
      <AttendanceControl
        requiresConfirmation
        canRespond
        initialStatus="maybe"
        onChange={onChange}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Partecipo' }))
    expect(screen.getByText('Salvataggio…')).toBeTruthy()

    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/risposta precedente è stata ripristinata/i))
    expect(screen.getByRole('button', { name: 'Forse' }).getAttribute('aria-pressed')).toBe('true')
  })

  it('shows a temporary success feedback after saving the response', async () => {
    jest.useFakeTimers()
    try {
      const onChange = jest.fn().mockResolvedValue(undefined)
      const view = render(<AttendanceControl requiresConfirmation canRespond onChange={onChange} />)

      fireEvent.click(screen.getByRole('button', { name: 'Partecipo' }))

      await waitFor(() => expect(screen.getByText('Risposta salvata')).toBeTruthy())
      expect(screen.getByText('La tua conferma è stata aggiornata.')).toBeTruthy()

      // The dashboard reflects the saved status back through initialStatus.
      view.rerender(<AttendanceControl requiresConfirmation canRespond initialStatus="going" onChange={onChange} />)
      expect(screen.getByText('Risposta salvata')).toBeTruthy()

      act(() => {
        jest.advanceTimersByTime(4000)
      })

      expect(screen.queryByText('Risposta salvata')).toBeNull()
    } finally {
      jest.useRealTimers()
    }
  })

  it('clears success feedback when a subsequent save fails', async () => {
    const onChange = jest.fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('Salvataggio non riuscito'))
    render(<AttendanceControl requiresConfirmation canRespond onChange={onChange} />)

    fireEvent.click(screen.getByRole('button', { name: 'Partecipo' }))
    await waitFor(() => expect(screen.getByText('Risposta salvata')).toBeTruthy())

    fireEvent.click(screen.getByRole('button', { name: 'Forse' }))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/risposta precedente è stata ripristinata/i))
    expect(screen.queryByText('Risposta salvata')).toBeNull()
  })
})
