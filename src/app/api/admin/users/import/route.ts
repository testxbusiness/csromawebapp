import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json({
    error: 'L’importazione degli atleti avviene dalla sezione Iscritti.'
  }, { status: 410 })
}
