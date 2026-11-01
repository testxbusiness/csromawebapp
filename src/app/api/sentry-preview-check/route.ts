import * as Sentry from '@sentry/nextjs'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Temporary, non-mutating Sentry smoke test. Remove after Preview verification. */
export async function POST() {
  if (process.env.VERCEL_ENV !== 'preview') {
    return new NextResponse(null, { status: 404 })
  }

  const eventId = Sentry.captureException(new Error('sentry-preview-server-check'))
  const flushed = await Sentry.flush(2_000)

  return NextResponse.json({ eventId, flushed }, { status: 202 })
}
