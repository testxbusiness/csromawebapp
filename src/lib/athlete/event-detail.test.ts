import { QueryClient } from '@tanstack/react-query'
import { athleteKeys } from '@/lib/query-keys'
import { athleteEventDetailQueryOptions } from './event-detail'

describe('athlete event detail query', () => {
  const input = {
    accountId: 'account-1',
    subjectProfileId: 'subject-1',
    subjectProfileQueryParam: 'subject-1',
    eventId: 'event-1',
  }

  beforeEach(() => {
    Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: true })
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: input.eventId, title: 'Allenamento', my_attendance: null }),
    }) as jest.Mock
  })

  it('reuses a fresh cached detail on close and reopen', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const options = athleteEventDetailQueryOptions(input)

    await queryClient.fetchQuery(options)
    await queryClient.fetchQuery(options)

    expect(global.fetch).toHaveBeenCalledTimes(1)
    expect(queryClient.getQueryData(athleteKeys.events.detail('account-1', 'subject-1', 'event-1'))).toMatchObject({ title: 'Allenamento' })
  })

  it('isolates event details by event and subject', () => {
    const eventA = athleteEventDetailQueryOptions(input).queryKey
    const eventB = athleteEventDetailQueryOptions({ ...input, eventId: 'event-2' }).queryKey
    const subjectB = athleteEventDetailQueryOptions({ ...input, subjectProfileId: 'subject-2' }).queryKey

    expect(eventA).not.toEqual(eventB)
    expect(eventA).not.toEqual(subjectB)
  })
})
