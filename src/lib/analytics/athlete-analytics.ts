'use client'

import posthog from 'posthog-js'
import type { AthleteAnalyticsEvent, AthleteAnalyticsSection } from './athlete-analytics-policy'
import { analyticsEnvironment, isAthleteAnalyticsEnabled, sanitizeAthleteAnalyticsProperties } from './athlete-analytics-policy'

const allowedEvents = new Set([
  '$pageview',
  '$identify',
  'athlete_attendance_response_saved',
  'athlete_absence_reported',
  'athlete_message_opened',
])
let initialized = false
let activeIdentity: string | null = null
let lifecycleEpoch = 0

function projectToken(): string | null {
  const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN?.trim()
  return token || null
}

function projectHost(): string {
  return (process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim() || 'https://eu.i.posthog.com').replace(/\/$/, '')
}

async function pseudonymousId(authUserId: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(authUserId))
  return `sha256:${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')}`
}

function initialize(token: string): void {
  if (initialized) return
  posthog.init(token, {
    api_host: projectHost(),
    autocapture: false,
    capture_pageview: false,
    capture_pageleave: false,
    capture_exceptions: false,
    disable_session_recording: true,
    disable_surveys: true,
    disable_external_dependency_loading: true,
    opt_out_capturing_by_default: true,
    opt_out_persistence_by_default: true,
    before_send: (event) => {
      if (!allowedEvents.has(event.event)) return null
      event.properties = sanitizeAthleteAnalyticsProperties(event.event, event.properties)
      event.properties.$geoip_disable = true
      return event
    },
  })
  initialized = true
}

export async function startAthleteAnalytics(authUserId: string): Promise<boolean> {
  const token = projectToken()
  if (!isAthleteAnalyticsEnabled() || !token || projectHost() !== 'https://eu.i.posthog.com' || !authUserId || !globalThis.crypto?.subtle) return false
  const currentEpoch = lifecycleEpoch
  initialize(token)
  const identity = await pseudonymousId(authUserId)
  if (currentEpoch !== lifecycleEpoch) return false
  if (activeIdentity !== identity) {
    if (activeIdentity) posthog.reset()
    posthog.opt_in_capturing({ captureEventName: false })
    posthog.identify(identity)
    activeIdentity = identity
  } else if (posthog.has_opted_out_capturing()) {
    posthog.opt_in_capturing({ captureEventName: false })
    posthog.identify(identity)
  }
  return true
}

export function stopAthleteAnalytics(): void {
  lifecycleEpoch += 1
  if (!initialized || !activeIdentity) return
  posthog.opt_out_capturing()
  posthog.reset()
  activeIdentity = null
}

export function trackAthleteEvent(event: AthleteAnalyticsEvent): void {
  if (!initialized || !activeIdentity || posthog.has_opted_out_capturing()) return
  posthog.capture(event.event, {
    ...event.properties,
    environment: analyticsEnvironment(),
  }, { send_instantly: true })
}

export function trackAthletePageView(section: AthleteAnalyticsSection): void {
  if (!initialized || !activeIdentity || posthog.has_opted_out_capturing()) return
  posthog.capture('$pageview', {
    page: section,
    environment: analyticsEnvironment(),
  }, { send_instantly: true })
}
