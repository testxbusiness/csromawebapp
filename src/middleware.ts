import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

// Rotte protette / pubbliche
const ADMIN_ONLY = [/^\/admin(\/.*)?$/]
const PUBLIC_ROUTES = [
  /^\/$/,
  /^\/login$/,
  /^\/reset-password$/,
  /^\/unauthorized$/
]
// esempio: const COACH_ONLY = [/^\/coach(\/.*)?$/]

function matchAny(pathname: string, patterns: RegExp[]) {
  return patterns.some((re) => re.test(pathname))
}

export async function middleware(req: NextRequest) {
  const url = req.nextUrl
  const { pathname } = url

  // lascia passare asset/static
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/images') ||
    pathname.startsWith('/fonts')
  ) {
    return NextResponse.next()
  }

  const res = NextResponse.next()

  // Crea un client SSR solo per leggere il JWT/cookie (niente query DB!)
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name) => req.cookies.get(name)?.value,
        set: (name, value, options) => res.cookies.set(name, value, options),
        remove: (name, options) => res.cookies.set(name, '', { ...options, maxAge: 0 }),
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Enforce password change for logged-in users based on JWT user_metadata
  if (user) {
    // @ts-ignore – runtime field from Supabase JWT
    const mustChange = user.user_metadata?.must_change_password === true

    // Avoid interfering with API routes
    const isApiRoute = pathname.startsWith('/api')

    // If the user must change password, redirect to reset-password (except when already there)
    if (mustChange && !isApiRoute && pathname !== '/reset-password') {
      const to = new URL('/reset-password', req.url)
      // Preserve original destination so we can return after reset
      to.searchParams.set('next', pathname)
      return NextResponse.redirect(to)
    }

    // If the user does not need to change password but is on reset-password, send to dashboard
    if (!mustChange && pathname === '/reset-password') {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }
  }

  // Richiedi autenticazione per tutte le route non pubbliche (escluso API)
  const isPublic = PUBLIC_ROUTES.some((re) => re.test(pathname))
  const isApiRoute = pathname.startsWith('/api')
  if (!user && !isPublic && !isApiRoute) {
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Se la rotta è admin-only, applica i controlli
  if (matchAny(pathname, ADMIN_ONLY)) {
    // non loggato -> manda a login
    if (!user) {
      const loginUrl = new URL('/login', req.url)
      loginUrl.searchParams.set('next', pathname) // per tornare dopo il login
      return NextResponse.redirect(loginUrl)
    }

    // risolvi ruolo dal JWT (mai fare select su profiles in middleware!)
    const rawRole =
      // @ts-ignore – campi runtime dal JWT
      user.app_metadata?.role ??
      // @ts-ignore
      user.user_metadata?.role ??
      null

    const role = rawRole ? String(rawRole).trim().toLowerCase() : ''

    if (role !== 'admin') {
      return NextResponse.redirect(new URL('/unauthorized', req.url))
    }
  }

  // Esempio per future sezioni:
  // if (matchAny(pathname, COACH_ONLY)) {
  //   if (!user) return NextResponse.redirect(new URL('/login', req.url))
  //   const role = (user.app_metadata?.role ?? user.user_metadata?.role ?? '').toString().trim().toLowerCase()
  //   if (!['coach', 'admin'].includes(role)) {
  //     return NextResponse.redirect(new URL('/unauthorized', req.url))
  //   }
  // }

  return res
}

// Esegui su tutte le route app (esclude asset/static)
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|images/.*|fonts/.*).*)'],
}
