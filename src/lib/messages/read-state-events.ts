export const MESSAGE_READ_STATE_CHANGED_EVENT = 'csroma:message-read-state-changed'

export type MessageReadStateChangedDetail = {
  messageId: string
  subjectProfileId: string | null
}

export function emitMessageReadStateChanged(detail: MessageReadStateChangedDetail): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent<MessageReadStateChangedDetail>(MESSAGE_READ_STATE_CHANGED_EVENT, { detail }))
}
