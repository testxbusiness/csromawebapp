export const athleteKeys = {
  all: ['athlete'] as const,
  messages: {
    all: (accountId: string, subjectProfileId: string) =>
      [...athleteKeys.all, accountId, subjectProfileId, 'messages'] as const,
    unread: (accountId: string, subjectProfileId: string) =>
      [...athleteKeys.messages.all(accountId, subjectProfileId), 'unread'] as const,
  },
}
