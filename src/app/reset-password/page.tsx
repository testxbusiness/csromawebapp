// Server Component: niente "use client" qui
import ResetPasswordForm from '@/components/shared/ResetPasswordForm'

export const dynamic = 'force-dynamic' // i token/param cambiano: evita prerender/caching

type ParamsShape = { [key: string]: string | string[] | undefined }

export default async function ResetPasswordPage({
  searchParams,
}: {
  // 👇 In Next 15 il prop è asincrono
  searchParams: Promise<ParamsShape>
}) {
  // 👇 Attendi i parametri prima di usarli
  const params = await searchParams

  // opzionale: supporta ?next=/percorso
  const raw = params?.next
  // Sanitize `next` to internal paths only
  const pick = (val: string | undefined) => {
    if (!val) return '/dashboard'
    // allow only site-internal paths (start with single "/"), block //, http(s), _next, api
    if (
      val.startsWith('/') &&
      !val.startsWith('//') &&
      !val.startsWith('/_next') &&
      !val.startsWith('/api') &&
      val !== '/auth/callback'
    ) {
      return val
    }
    return '/dashboard'
  }
  const nextPath = Array.isArray(raw) ? pick(raw[0]) : pick(typeof raw === 'string' ? raw : undefined)

  return <ResetPasswordForm nextPath={nextPath} />
}
