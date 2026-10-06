export const athleteKeys = {
  all: ['athlete'] as const,
  profile: (accountId: string, subjectProfileId: string) =>
    [...athleteKeys.all, accountId, subjectProfileId, 'profile'] as const,
  administration: (accountId: string, subjectProfileId: string) =>
    [...athleteKeys.all, accountId, subjectProfileId, 'administration'] as const,
  calendar: (accountId: string, subjectProfileId: string) =>
    [...athleteKeys.all, accountId, subjectProfileId, 'calendar'] as const,
  messages: {
    all: (accountId: string, subjectProfileId: string) =>
      [...athleteKeys.all, accountId, subjectProfileId, 'messages'] as const,
    list: (accountId: string, subjectProfileId: string) =>
      [...athleteKeys.messages.all(accountId, subjectProfileId), 'list'] as const,
    detail: (accountId: string, subjectProfileId: string, messageId: string) =>
      [...athleteKeys.messages.all(accountId, subjectProfileId), 'detail', messageId] as const,
    unread: (accountId: string, subjectProfileId: string) =>
      [...athleteKeys.messages.all(accountId, subjectProfileId), 'unread'] as const,
  },
}
