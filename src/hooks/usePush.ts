'use client'

import { useCallback } from 'react'

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i)
  return outputArray
}

export function usePush() {
  const registerSW = useCallback(async () => {
    if (!('serviceWorker' in navigator)) return null
    const reg = await navigator.serviceWorker.register('/push-sw.js')
    return reg
  }, [])

  const subscribe = useCallback(async (label?: string) => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) throw new Error('Push unsupported')
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') throw new Error('Permission denied')
    const reg = await registerSW()
    if (!reg) throw new Error('SW registration failed')
    const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    if (!vapid) throw new Error('Missing VAPID public key')
    const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapid) })
    const res = await fetch('/api/notifications/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: sub.endpoint, keys: (sub as any).toJSON().keys, user_agent: navigator.userAgent, device_label: label || null })
    })
    if (!res.ok) throw new Error('Subscription save failed')
    return sub
  }, [registerSW])

  const unsubscribe = useCallback(async () => {
    if (!('serviceWorker' in navigator)) return
    const reg = await navigator.serviceWorker.getRegistration()
    const sub = await reg?.pushManager.getSubscription()
    if (sub) {
      await fetch('/api/notifications/unsubscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: sub.endpoint }) })
      await sub.unsubscribe()
    }
  }, [])

  return { registerSW, subscribe, unsubscribe }
}

