import { createAdminClient } from '@/lib/supabase/server'
import webPush from 'web-push'

type PushPayload = {
  title: string
  body: string
  url?: string
  icon?: string
  badge?: string
}

function configureWebPush() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  const subject = process.env.VAPID_SUBJECT || 'mailto:no-reply@csroma.it'
  if (!publicKey || !privateKey) {
    return { configured: false as const, reason: 'VAPID keys are not configured on the server' }
  }
  webPush.setVapidDetails(subject, publicKey, privateKey)
  return { configured: true as const }
}

async function fetchUserSubscriptions(profileId: string) {
  const admin = createAdminClient()
  const { data: account } = await admin
    .from('app_accounts')
    .select('auth_user_id')
    .eq('owner_profile_id', profileId)
    .maybeSingle()

  if (!account?.auth_user_id) return []

  const { data } = await admin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('auth_user_id', account.auth_user_id)
    .eq('revoked', false)
  return data || []
}

export async function sendToUser(profileId: string, payload: PushPayload) {
  const configuration = configureWebPush()
  if (!configuration.configured) {
    console.warn(`[push] skipped: ${configuration.reason}`)
    return { skipped: true, sent: 0, failed: 0, reason: configuration.reason }
  }
  const subs = await fetchUserSubscriptions(profileId)
  let sent = 0
  let failed = 0
  await Promise.all(subs.map(async (s: any) => {
    try {
      await webPush.sendNotification({
        endpoint: s.endpoint,
        keys: { p256dh: s.p256dh, auth: s.auth },
      }, JSON.stringify(payload))
      sent += 1
    } catch (e: any) {
      failed += 1
      if (e?.statusCode === 404 || e?.statusCode === 410) {
        const admin = createAdminClient()
        await admin.from('push_subscriptions').update({ revoked: true }).eq('id', s.id)
      } else {
        console.error('push error', e)
      }
    }
  }))
  return { skipped: false, subscriptions: subs.length, sent, failed }
}

export async function sendToUsers(userIds: string[], payload: PushPayload) {
  await Promise.all(userIds.map((id) => sendToUser(id, payload)))
}
