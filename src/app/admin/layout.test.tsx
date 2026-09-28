import { AccountContextError } from '@/server/auth/require-account-context'
import { createClient } from '@/lib/supabase/server'
import { requireGlobalRole } from '@/server/auth/require-global-role'
import AdminLayout from './layout'

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}))

jest.mock('@/server/auth/require-global-role', () => ({
  requireGlobalRole: jest.fn(),
}))

jest.mock('next/navigation', () => ({
  redirect: (destination: string) => {
    throw new Error(`REDIRECT:${destination}`)
  },
}))

describe('admin page boundary', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.mocked(createClient).mockResolvedValue({} as Awaited<ReturnType<typeof createClient>>)
  })

  it('mounts children for an admin account', async () => {
    const children = <div>admin content</div>

    await expect(AdminLayout({ children })).resolves.toBe(children)
    expect(jest.mocked(requireGlobalRole)).toHaveBeenCalledWith({}, 'admin')
  })

  it('redirects unauthenticated users to login', async () => {
    jest.mocked(requireGlobalRole).mockRejectedValue(new AccountContextError('Autenticazione richiesta', 401))

    await expect(AdminLayout({ children: null })).rejects.toThrow('REDIRECT:/login?next=%2Fadmin')
  })

  it('redirects authenticated non-admin users to unauthorized', async () => {
    jest.mocked(requireGlobalRole).mockRejectedValue(new AccountContextError('Ruolo globale non autorizzato', 403))

    await expect(AdminLayout({ children: null })).rejects.toThrow('REDIRECT:/unauthorized')
  })
})
