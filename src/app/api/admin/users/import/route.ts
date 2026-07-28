import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { importedUsersPayloadSchema } from '@/lib/validation/users'

const AUTH_CALLBACK_URL = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/callback`

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const adminClient = createAdminClient()
    const parsed = importedUsersPayloadSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dati importazione non validi' }, { status: 400 })
    }
    const users = parsed.data.users

    // AuthZ: only admin can import
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
const role = (user as any)?.app_metadata?.role
    if (role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const results: { email: string; ok: boolean; error?: string }[] = []

    for (const u of users) {
      try {
        // Create the account through Supabase's expiring invitation flow.
        const { data: authData, error: createErr } = await adminClient.auth.admin.inviteUserByEmail(u.email, {
          redirectTo: AUTH_CALLBACK_URL,
          data: {
            first_name: u.first_name,
            last_name: u.last_name,
          },
        })
        if (createErr || !authData?.user) {
          throw new Error(createErr?.message || 'Errore creazione invito utente')
        }

        const { error: metadataError } = await adminClient.auth.admin.updateUserById(authData.user.id, {
          app_metadata: { role: u.role, must_change_password: true },
        })
        if (metadataError) {
          throw new Error(metadataError.message)
        }

        // Upsert profile
        const { error: profileErr } = await adminClient
          .from('profiles')
          .upsert({
            id: authData.user.id,
            email: u.email,
            first_name: u.first_name,
            last_name: u.last_name,
            role: u.role,
            phone_number: u.phone_number || null,
            date_of_birth: u.date_of_birth || null,
            must_change_password: true
          })
        if (profileErr) {
          throw new Error(profileErr.message)
        }

        results.push({ email: u.email, ok: true })
      } catch (e: any) {
        results.push({ email: u.email, ok: false, error: e?.message || 'Errore sconosciuto' })
      }
    }

    const errors = results.filter(r => !r.ok)
    if (errors.length > 0) {
      return NextResponse.json({ success: false, results }, { status: 207 })
    }
    return NextResponse.json({ success: true, results })
  } catch (error) {
    console.error('Errore import utenti:', error)
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 })
  }
}
