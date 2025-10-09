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
  const nextPath =
    typeof raw === 'string'
      ? raw
      : Array.isArray(raw)
      ? raw[0] ?? '/dashboard'
      : '/dashboard'

  return <ResetPasswordForm nextPath={nextPath} />
}
