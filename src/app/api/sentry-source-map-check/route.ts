import * as Sentry from '@sentry/nextjs'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Temporary Preview-only source-map probe. Remove after verification. */
export async function POST() {
  if (process.env.VERCEL_ENV !== 'preview') {
    return new NextResponse(null, { status: 404 })
  }

  try {
    const { triggerPreviewSourceMapProbe } = await import('@/lib/sentry/preview-source-map-probe')
    triggerPreviewSourceMapProbe()
  } catch (error) {
    const eventId = Sentry.captureException(error)
    const flushed = await Sentry.flush(2_000)
    return NextResponse.json({ eventId, flushed }, { status: 202 })
  }

  return NextResponse.json({ accepted: false }, { status: 500 })
}
