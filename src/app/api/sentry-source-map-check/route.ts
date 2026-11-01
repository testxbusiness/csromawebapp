import * as Sentry from '@sentry/nextjs'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Temporary Preview-only source-map smoke test. Remove after verification. */
function createSourceMappedPreviewError(): Error {
  return new Error('sentry-preview-source-map-check')
}

export async function POST() {
  if (process.env.VERCEL_ENV !== 'preview') {
    return new NextResponse(null, { status: 404 })
  }

  const eventId = Sentry.captureException(createSourceMappedPreviewError())
  const flushed = await Sentry.flush(2_000)

  return NextResponse.json({ eventId, flushed }, { status: 202 })
}
