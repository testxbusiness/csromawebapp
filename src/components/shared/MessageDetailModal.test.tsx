import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import MessageDetailModal from './MessageDetailModal'

describe('MessageDetailModal', () => {
  afterEach(() => { delete (globalThis as { fetch?: unknown }).fetch })

  it('marks an unread message through the backend and reports the authoritative state', async () => {
    const onReadStateChange = jest.fn()
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, read_state: { is_read: true, read_at: '2026-08-28T12:00:00Z' } }),
    } as Response)
    globalThis.fetch = fetchMock

    render(<MessageDetailModal
      open
      onClose={jest.fn()}
      messageId="m1"
      subjectProfileId="p1"
      markAsRead
      readState={{ is_read: false, read_at: null }}
      onReadStateChange={onReadStateChange}
      data={{
        subject: 'Convocazione',
        content: 'Presentarsi alle 18.',
        created_at: '2026-08-28T10:00:00Z',
        created_by_profile: { first_name: 'Anna', last_name: 'Rossi', role: 'coach' },
      }}
    />)

    expect(screen.getByText('Convocazione')).toBeTruthy()
    await waitFor(() => expect(onReadStateChange).toHaveBeenCalledWith({ is_read: true, read_at: '2026-08-28T12:00:00Z' }))
    expect(fetchMock).toHaveBeenCalledWith('/api/messages/read', expect.objectContaining({ method: 'POST' }))
  })

  it('does not write again when the backend already says the message is read', async () => {
    const fetchMock = jest.fn()
    globalThis.fetch = fetchMock
    render(<MessageDetailModal
      open
      onClose={jest.fn()}
      messageId="m1"
      markAsRead
      readState={{ is_read: true, read_at: '2026-08-28T12:00:00Z' }}
      data={{ subject: 'Letto', content: 'Test' }}
    />)
    await waitFor(() => expect(fetchMock).not.toHaveBeenCalled())
  })

  it('requests a signed attachment URL only after the user asks to download it', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ attachment: { download_url: 'https://storage.example/signed-token' } }),
    } as Response)
    globalThis.fetch = fetchMock
    render(<MessageDetailModal
      open
      onClose={jest.fn()}
      subjectProfileId="p1"
      data={{ subject: 'Documento', content: 'Test', attachments: [{ id: 'a1', file_name: 'documento.pdf' }] }}
    />)

    expect(fetchMock).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'documento.pdf' }))
    await waitFor(() => expect(screen.getByRole('link', { name: 'documento.pdf' })).toBeTruthy())
    expect(fetchMock).toHaveBeenCalledWith('/api/athlete/messages/attachments/a1?subjectProfileId=p1', { cache: 'no-store' })
  })

  it('shows an explicit error when the signed URL cannot be generated', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Allegato non disponibile' }),
    } as Response)
    globalThis.fetch = fetchMock
    render(<MessageDetailModal
      open
      onClose={jest.fn()}
      data={{ subject: 'Documento', content: 'Test', attachments: [{ id: 'a1', file_name: 'documento.pdf' }] }}
    />)

    fireEvent.click(screen.getByRole('button', { name: 'documento.pdf' }))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Allegato non disponibile'))
  })
})
