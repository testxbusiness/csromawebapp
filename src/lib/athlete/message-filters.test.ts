import { filterAthleteMessages } from './message-filters'

const messages = [
  { id: 'm1', subject: 'Uno', content: '', created_at: '', is_read: false, teams: [{ id: 't1', name: 'U16' }] },
  { id: 'm2', subject: 'Due', content: '', created_at: '', is_read: true, teams: [{ id: 't1', name: 'U16' }, { id: 't2', name: 'U18' }] },
]

describe('filterAthleteMessages', () => {
  it('filters unread messages and keeps the unread count scoped to the full list', () => {
    expect(filterAthleteMessages(messages, 'unread', null).map((message) => message.id)).toEqual(['m1'])
  })

  it('matches a multi-team message once when one selected team matches', () => {
    expect(filterAthleteMessages(messages, 'all', 't2').map((message) => message.id)).toEqual(['m2'])
  })

  it('does not duplicate a message linked to multiple teams', () => {
    expect(filterAthleteMessages(messages, 'all', 't1')).toHaveLength(2)
  })
})
