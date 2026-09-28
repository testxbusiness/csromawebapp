jest.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init: { status?: number; headers?: Record<string, string> }) => ({
      body,
      status: init.status ?? 200,
      headers: new Headers(init.headers),
      json: async () => body,
    }),
  },
}))

const { noStoreJson } = require('@/server/http/no-store') as typeof import('@/server/http/no-store')

describe('athlete message attachment response caching', () => {
  it('marks signed URL metadata as private and non-cacheable', async () => {
    const response = noStoreJson({ attachment: { download_url: 'https://storage.example/signed' } })

    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
    await expect(response.json()).resolves.toEqual({ attachment: { download_url: 'https://storage.example/signed' } })
  })
})
