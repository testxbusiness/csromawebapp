import { buildMessagePushUrl, resolveMessagePushArea } from './push-notifications'

describe('buildMessagePushUrl', () => {
  it('creates a safe message destination without authorization parameters', () => {
    expect(buildMessagePushUrl('athlete', 'message/id')).toBe('/athlete/messages?messageId=message%2Fid')
    expect(buildMessagePushUrl('coach', 'm1')).toBe('/coach/messages?messageId=m1')
    expect(buildMessagePushUrl('admin', 'm1')).toBe('/admin/messages?messageId=m1')
    expect(buildMessagePushUrl('athlete', 'm1', 'subject-1')).toBe('/athlete/messages?messageId=m1&subjectProfileId=subject-1')
    expect(buildMessagePushUrl('athlete', 'm1')).not.toMatch(/subject|team/i)
  })

  it('resolves the destination from account roles without trusting URL context', () => {
    expect(resolveMessagePushArea(['coach', 'athlete'])).toBe('athlete')
    expect(resolveMessagePushArea(['family_member'])).toBe('athlete')
    expect(resolveMessagePushArea(['coach'])).toBe('coach')
    expect(resolveMessagePushArea(['admin'])).toBe('admin')
    expect(resolveMessagePushArea(['staff'])).toBeNull()
  })
})
