import { execFileSync } from 'node:child_process'
import { createPrivateKey, sign } from 'node:crypto'
import { readFileSync } from 'node:fs'

const envText = readFileSync('.env.local', 'utf8')
const env = Object.fromEntries(
  [...envText.matchAll(/^([A-Z0-9_]+)=?\"?([^\"\n]*)\"?$/gm)].map(([, key, value]) => [key, value])
)
const baseUrl = env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321'
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
if (!anonKey) throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY mancante in .env.local')

const authEnv = execFileSync('docker', ['exec', 'supabase_auth_csromawebapp', 'env'], { encoding: 'utf8' })
const jwtKeys = JSON.parse(authEnv.match(/^GOTRUE_JWT_KEYS=(.+)$/m)?.[1] || '[]')
const signingKey = jwtKeys.find((key) => key.alg === 'ES256' && key.d)
if (!signingKey) throw new Error('Chiave JWT ES256 locale non disponibile')

const b64url = (value) => Buffer.from(value).toString('base64url')
function tokenFor(userId, role) {
  const now = Math.floor(Date.now() / 1000)
  const header = { alg: 'ES256', kid: signingKey.kid, typ: 'JWT' }
  const payload = {
    iss: `${baseUrl}/auth/v1`,
    aud: 'authenticated',
    exp: now + 300,
    iat: now,
    sub: userId,
    role: 'authenticated',
    app_metadata: { role },
  }
  const input = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`
  const key = createPrivateKey({ key: signingKey, format: 'jwk' })
  const signature = sign('sha256', Buffer.from(input), { key, dsaEncoding: 'ieee-p1363' })
  return `${input}.${signature.toString('base64url')}`
}

async function get(label, path, token) {
  const response = await fetch(`${baseUrl}/rest/v1/${path}`, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${token || anonKey}`,
    },
  })
  const text = await response.text()
  let body = text
  try { body = JSON.parse(text) } catch {}
  console.log(`${response.ok ? 'PASS' : 'DENY'} ${label}: HTTP ${response.status}`, body)
  return { response, body }
}

const adminId = 'ead3c978-c178-4b38-a541-9ecedc6fa9f1'
const athleteId = '4562c612-68d8-4bd2-b40a-fbe72b48c10a'
const coachId = 'e2ee7e93-d957-4ddd-9a1c-867b64d4b4d4'

console.log('=== REST/PostgREST locale: test read-only RLS ===')
await get('anon profiles deve essere negato', 'profiles?select=id&limit=1')

const athlete = await get('athlete profiles', 'profiles?select=id,role&order=id', tokenFor(athleteId, 'athlete'))
if (athlete.response.ok) {
  const rows = Array.isArray(athlete.body) ? athlete.body : []
  if (!rows.some((row) => row.id === athleteId)) throw new Error('Atleta: profilo proprio non visibile')
  if (rows.some((row) => row.id === adminId)) throw new Error('Atleta: profilo admin visibile')
}
await get('athlete payments deve restituire zero righe', 'payments?select=id', tokenFor(athleteId, 'athlete'))
await get('athlete user_roles deve restituire zero righe', 'user_roles?select=profile_id', tokenFor(athleteId, 'athlete'))

const coach = await get('coach profiles', 'profiles?select=id,role&order=id', tokenFor(coachId, 'coach'))
if (coach.response.ok) {
  const rows = Array.isArray(coach.body) ? coach.body : []
  if (rows.some((row) => row.id === adminId)) throw new Error('Coach: profilo admin visibile')
}
await get('coach events', 'events?select=id&limit=1000', tokenFor(coachId, 'coach'))
await get('coach payments deve restituire zero righe', 'payments?select=id', tokenFor(coachId, 'coach'))

await get('admin profiles', 'profiles?select=id&limit=1000', tokenFor(adminId, 'admin'))
await get('admin documents', 'documents?select=id&limit=1000', tokenFor(adminId, 'admin'))
await get('admin payments', 'payments?select=id&limit=1000', tokenFor(adminId, 'admin'))

console.log('Completato: nessuna operazione INSERT/UPDATE/DELETE eseguita.')
