import { createAdminClient } from '@/lib/supabase/server'

type PushPayload = {
  title: string
  body: string
  url?: string
  icon?: string
  badge?: string
}

async function getWebPush() {
  try {
    // Use eval('require') to avoid bundler static resolution when dependency is missing
    // This lets the app build even if 'web-push' is not yet installed.
    // At runtime, if the module is missing, we catch and skip gracefully.
    // eslint-disable-next-line no-eval
    const req: any = eval('require')
    const webPush = req('web-push') as any
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    const privateKey = process.env.VAPID_PRIVATE_KEY
    const subject = process.env.VAPID_SUBJECT || 'mailto:no-reply@csroma.it'
    if (!publicKey || !privateKey) throw new Error('Missing VAPID keys')
    webPush.setVapidDetails(subject, publicKey, privateKey)
    return webPush
  } catch (e) {
    console.warn('[push] web-push unavailable or VAPID missing. Install "web-push" and set VAPID keys. Skipping push send. Error:', e)
    return null
  }
}

async function fetchUserSubscriptions(userId: string) {
  const admin = createAdminClient()
  const { data } = await admin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('profile_id', userId)
    .eq('revoked', false)
  return data || []
}

export async function sendToUser(userId: string, payload: PushPayload) {
  const webPush = await getWebPush()
  if (!webPush) return { skipped: true }
  const subs = await fetchUserSubscriptions(userId)
  await Promise.all(subs.map(async (s: any) => {
    try {
      await webPush.sendNotification({
        endpoint: s.endpoint,
        keys: { p256dh: s.p256dh, auth: s.auth },
      }, JSON.stringify(payload))
    } catch (e: any) {
      if (e?.statusCode === 404 || e?.statusCode === 410) {
        const admin = createAdminClient()
        await admin.from('push_subscriptions').update({ revoked: true }).eq('id', s.id)
      } else {
        console.error('push error', e)
      }
    }
  }))
}

export async function sendToUsers(userIds: string[], payload: PushPayload) {
  await Promise.all(userIds.map((id) => sendToUser(id, payload)))
}
