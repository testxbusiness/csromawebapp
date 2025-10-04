import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Simple in-memory rate limiter (per process) for admin API mutations
const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX = 60
const rateStore = new Map<string, { count: number; resetAt: number }>()

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: any) {
          response.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: any) {
          response.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    }
  )

  const {
    data: { session },
  } = await supabase.auth.getSession()

  // Protezione route autenticate
  if (request.nextUrl.pathname.startsWith('/dashboard') ||
      request.nextUrl.pathname.startsWith('/admin') ||
      request.nextUrl.pathname.startsWith('/allenatore') ||
      request.nextUrl.pathname.startsWith('/atleta')) {
    
    if (!session) {
      const redirectUrl = new URL('/login', request.url)
      return NextResponse.redirect(redirectUrl)
    }
  }

  // Se già autenticato, reindirizza dalla login alla dashboard
  if (request.nextUrl.pathname === '/login' && session) {
    const redirectUrl = new URL('/dashboard', request.url)
    return NextResponse.redirect(redirectUrl)
  }

  // Redirect obbligato per cambio password se must_change_password = true
  if (session) {
    // Ottieni il profilo dell'utente per verificare must_change_password
    const { data: profile } = await supabase
      .from('profiles')
      .select('must_change_password')
      .eq('id', session.user.id)
      .single()

    const mustChangePassword = 
      session.user.user_metadata?.must_change_password === true ||
      profile?.must_change_password === true

    // Whitelist delle route permesse durante il cambio password obbligato
    const allowedPaths = [
      '/reset-password',
      '/login',
      '/logout',
      '/unauthorized',
      '/api',
      '/_next',
      '/favicon.ico'
    ]

    const isAllowedPath = allowedPaths.some(path => 
      request.nextUrl.pathname.startsWith(path)
    )

    if (mustChangePassword && !isAllowedPath) {
      const redirectUrl = new URL('/reset-password', request.url)
      redirectUrl.searchParams.set('next', request.nextUrl.pathname)
      return NextResponse.redirect(redirectUrl)
    }
  }

  // Role-based routing (JWT user_metadata.role)
  if (session) {
    const role = session.user?.user_metadata?.role
    const path = request.nextUrl.pathname

    const isAdminArea = path.startsWith('/admin')
    const isCoachArea = path.startsWith('/coach')
    const isAthleteArea = path.startsWith('/athlete')

    if (isAdminArea && role !== 'admin') {
      const redirectUrl = new URL('/unauthorized', request.url)
      return NextResponse.redirect(redirectUrl)
    }

    if (isCoachArea && role !== 'coach') {
      const redirectUrl = new URL('/unauthorized', request.url)
      return NextResponse.redirect(redirectUrl)
    }

    if (isAthleteArea && role !== 'athlete') {
      const redirectUrl = new URL('/unauthorized', request.url)
      return NextResponse.redirect(redirectUrl)
    }
  }

  // Rate limiting for admin API mutations (low-risk guard)
  if (request.nextUrl.pathname.startsWith('/api/admin') && ['POST','PUT','PATCH','DELETE'].includes(request.method)) {
    const ip = request.ip || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local'
    const key = `${ip}:${request.nextUrl.pathname}`
    const now = Date.now()
    const entry = rateStore.get(key)
    if (!entry || now > entry.resetAt) {
      rateStore.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    } else {
      entry.count += 1
      if (entry.count > RATE_LIMIT_MAX) {
        return new NextResponse(JSON.stringify({ error: 'Too Many Requests' }), {
          status: 429,
          headers: { 'Content-Type': 'application/json' }
        })
      }
    }
  }

  return response
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}
