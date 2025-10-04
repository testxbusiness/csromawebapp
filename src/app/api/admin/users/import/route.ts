import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

type ImportedUser = {
  first_name: string
  last_name: string
  email: string
  phone_number?: string
  date_of_birth?: string
  role: 'admin' | 'coach' | 'athlete'
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const adminClient = createAdminClient()
    const body = await request.json()
    const users: ImportedUser[] = body?.users || []

    // AuthZ: only admin can import
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const role = (user as any)?.user_metadata?.role
    if (role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (!Array.isArray(users) || users.length === 0) {
      return NextResponse.json({ error: 'Nessun utente da importare' }, { status: 400 })
    }

    const results: { email: string; ok: boolean; error?: string }[] = []

    for (const u of users) {
      try {
        // Create auth user with fixed initial password
        const { data: authData, error: createErr } = await supabase.auth.admin.createUser({
          email: u.email,
          password: 'csroma2025!',
          email_confirm: true,
          user_metadata: {
            first_name: u.first_name,
            last_name: u.last_name,
            role: u.role,
            must_change_password: true,
            temp_password_set_at: new Date().toISOString(),
            temp_password_expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString()
          }
        })
        if (createErr || !authData?.user) {
          throw new Error(createErr?.message || 'Errore creazione utente auth')
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
