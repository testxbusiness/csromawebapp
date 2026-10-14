import { fireEvent, render, screen } from '@testing-library/react'
import ThemeToggle from './ThemeToggle'
import { useTheme } from '@/hooks/useTheme'

jest.mock('@/hooks/useTheme', () => ({ useTheme: jest.fn() }))

const themeMock = useTheme as jest.MockedFunction<typeof useTheme>

describe('ThemeToggle', () => {
  it('labels and toggles the current theme', () => {
    const toggleTheme = jest.fn()
    themeMock.mockReturnValue({ theme: 'light', toggleTheme })

    render(<ThemeToggle />)

    const toggle = screen.getByRole('button', { name: 'Attiva tema scuro' })
    expect(toggle).toHaveAttribute('aria-pressed', 'false')

    fireEvent.click(toggle)

    expect(toggleTheme).toHaveBeenCalledTimes(1)
  })
})
