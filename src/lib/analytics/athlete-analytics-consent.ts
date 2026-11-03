export type AthleteAnalyticsConsentChoice = 'accepted' | 'denied' | null

export const ATHLETE_ANALYTICS_CONSENT_CHANGED = 'csroma:athlete-analytics-consent-changed'

function consentStorageKey(authUserId: string): string {
  return `csroma:athlete-analytics-consent:v1:${authUserId}`
}

export function readAthleteAnalyticsConsent(authUserId: string): AthleteAnalyticsConsentChoice {
  try {
    const value = window.localStorage.getItem(consentStorageKey(authUserId))
    return value === 'accepted' || value === 'denied' ? value : null
  } catch {
    return null
  }
}

export function saveAthleteAnalyticsConsent(authUserId: string, choice: Exclude<AthleteAnalyticsConsentChoice, null>): void {
  try {
    window.localStorage.setItem(consentStorageKey(authUserId), choice)
  } catch {
    // The in-memory choice still applies for the current page session.
  }
  window.dispatchEvent(new CustomEvent(ATHLETE_ANALYTICS_CONSENT_CHANGED, { detail: { authUserId, choice } }))
}
