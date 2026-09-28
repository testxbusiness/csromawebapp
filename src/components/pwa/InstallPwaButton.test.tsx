import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import InstallPwaButton from './InstallPwaButton'

describe('InstallPwaButton', () => {
  const originalUserAgent = navigator.userAgent

  beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', { configurable: true, value: jest.fn().mockReturnValue({ matches: false }) })
    Object.defineProperty(navigator, 'userAgent', { configurable: true, value: originalUserAgent })
  })

  it('stays hidden when the app is already standalone', () => {
    Object.defineProperty(window, 'matchMedia', { configurable: true, value: jest.fn().mockReturnValue({ matches: true }) })
    render(<InstallPwaButton />)
    expect(screen.queryByRole('button', { name: 'Installa app' })).toBeNull()
  })

  it('captures the browser prompt but opens it only after clicking', async () => {
    const prompt = jest.fn().mockResolvedValue(undefined)
    const userChoice = Promise.resolve({ outcome: 'accepted' as const })
    render(<InstallPwaButton />)

    const event = new Event('beforeinstallprompt', { cancelable: true }) as Event & { prompt: typeof prompt; userChoice: typeof userChoice }
    event.prompt = prompt
    event.userChoice = userChoice
    fireEvent(window, event)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Installa app' })).toBeTruthy())
    expect(prompt).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Installa app' }))
    await waitFor(() => expect(prompt).toHaveBeenCalledTimes(1))
  })

  it('shows dedicated iOS instructions instead of a fake install action', () => {
    Object.defineProperty(navigator, 'userAgent', { configurable: true, value: 'Mozilla/5.0 (iPhone)' })
    render(<InstallPwaButton />)
    expect(screen.getByText(/Condividi/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Installa app' })).toBeNull()
  })
})
