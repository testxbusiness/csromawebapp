import { createClient } from '@/lib/supabase/client'

export interface NotificationRule {
  id: string
  type: 'medical_certificate' | 'fee_installment' | 'event_reminder'
  title: string
  message_template: string
  trigger_days: number // Days before event
  is_active: boolean
  created_at: string
}

export interface PendingNotification {
  id: string
  type: string
  target_user_id: string
  target_email: string
  title: string
  message: string
  trigger_date: string
  sent_at?: string
  target_data: Record<string, any>
}

// Check for pending notifications and send them
export async function processNotifications() {
  const supabase = createClient()
  const today = new Date().toISOString().split('T')[0]

  try {
    // Medical certificate reminders
    await processMedicalCertificateReminders(supabase, today)
    
    // Fee installment reminders  
    await processFeeInstallmentReminders(supabase, today)
    
    // Event reminders
    await processEventReminders(supabase, today)

    console.log('Notifications processed successfully')
  } catch (error) {
    console.error('Error processing notifications:', error)
  }
}

async function processMedicalCertificateReminders(supabase: any, today: string) {
  // Get athletes with medical certificates expiring in 30 days
  const expiryDate = new Date()
  expiryDate.setDate(expiryDate.getDate() + 30)
  const expiryDateStr = expiryDate.toISOString().split('T')[0]

  const { data: expiringCertificates } = await supabase
    .from('team_members')
    .select(`
      id,
      medical_certificate_expiry,
      profile:profiles!inner(
        id,
        first_name,
        last_name,
        email
      ),
      team:teams(
        name
      )
    `)
    .lte('medical_certificate_expiry', expiryDateStr)
    .gte('medical_certificate_expiry', today)
    .not('medical_certificate_expiry', 'is', null)

  if (!expiringCertificates || expiringCertificates.length === 0) return

  for (const cert of expiringCertificates) {
    const daysUntilExpiry = Math.ceil(
      (new Date(cert.medical_certificate_expiry).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
    )

    const notification = {
      type: 'medical_certificate',
      target_user_id: cert.profile.id,
      target_email: cert.profile.email,
      title: 'Certificato Medico in Scadenza',
      message: `Ciao ${cert.profile.first_name},\n\nIl tuo certificato medico per la squadra ${cert.team.name} scadrà il ${new Date(cert.medical_certificate_expiry).toLocaleDateString('it-IT')} (tra ${daysUntilExpiry} giorni).\n\nTi preghiamo di rinnovarlo presso il tuo medico di fiducia e consegnare il nuovo certificato alla segreteria.\n\nGrazie,\nCS Roma`,
      trigger_date: today,
      target_data: {
        expiry_date: cert.medical_certificate_expiry,
        team_name: cert.team.name,
        days_until_expiry: daysUntilExpiry
      }
    }

    // Check if notification already sent
    const { data: existingNotification } = await supabase
      .from('pending_notifications')
      .select('id')
      .eq('type', 'medical_certificate')
      .eq('target_user_id', cert.profile.id)
      .eq('trigger_date', today)
      .single()

    if (!existingNotification) {
      await supabase
        .from('pending_notifications')
        .insert([notification])

      // Send notification immediately
      await sendNotification(notification)
    }
  }
}

async function processFeeInstallmentReminders(supabase: any, today: string) {
  // Get fee installments due in 30 days
  const dueDate = new Date()
  dueDate.setDate(dueDate.getDate() + 30)
  const dueDateStr = dueDate.toISOString().split('T')[0]

  const { data: dueFees } = await supabase
    .from('fee_installments')
    .select(`
      id,
      installment_number,
      due_date,
      amount,
      profile:profiles!inner(
        id,
        first_name,
        last_name,
        email
      ),
      membership_fee:membership_fees(
        name,
        team:teams(name)
      )
    `)
    .eq('status', 'not_due')
    .lte('due_date', dueDateStr)
    .gte('due_date', today)

  if (!dueFees || dueFees.length === 0) return

  for (const fee of dueFees) {
    const daysUntilDue = Math.ceil(
      (new Date(fee.due_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
    )

    const notification = {
      type: 'fee_installment',
      target_user_id: fee.profile.id,
      target_email: fee.profile.email,
      title: 'Rata in Scadenza',
      message: `Ciao ${fee.profile.first_name},\n\nLa rata ${fee.installment_number} per ${fee.membership_fee.name} (${fee.membership_fee.team.name}) di €${fee.amount} scadrà il ${new Date(fee.due_date).toLocaleDateString('it-IT')}.\n\nTi preghiamo di provvedere al pagamento entro la scadenza.\n\nGrazie,\nCS Roma`,
      trigger_date: today,
      target_data: {
        installment_number: fee.installment_number,
        amount: fee.amount,
        due_date: fee.due_date,
        team_name: fee.membership_fee.team.name,
        days_until_due: daysUntilDue
      }
    }

    // Check if notification already sent
    const { data: existingNotification } = await supabase
      .from('pending_notifications')
      .select('id')
      .eq('type', 'fee_installment')
      .eq('target_user_id', fee.profile.id)
      .eq('trigger_date', today)
      .single()

    if (!existingNotification) {
      await supabase
        .from('pending_notifications')
        .insert([notification])

      // Send notification immediately
      await sendNotification(notification)

      // Update installment status
      await supabase
        .from('fee_installments')
        .update({ status: 'due_soon' })
        .eq('id', fee.id)
    }
  }
}

async function processEventReminders(supabase: any, today: string) {
  // Get events happening tomorrow
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = tomorrow.toISOString().split('T')[0]

  const { data: upcomingEvents } = await supabase
    .from('events')
    .select(`
      id,
      title,
      start_time,
      location,
      description,
      event_teams!inner(
        team:teams!inner(
          id,
          name,
          team_members(
            profile:profiles(
              id,
              first_name,
              last_name,
              email
            )
          )
        )
      )
    `)
    .gte('start_time', `${tomorrowStr}T00:00:00`)
    .lt('start_time', `${tomorrowStr}T23:59:59`)

  if (!upcomingEvents || upcomingEvents.length === 0) return

  for (const event of upcomingEvents) {
    // Get all team members for this event
    const teamMembers = event.event_teams.flatMap(et => 
      et.team.team_members.map(tm => ({
        ...tm.profile,
        team_name: et.team.name
      }))
    )

    for (const member of teamMembers) {
      const notification = {
        type: 'event_reminder',
        target_user_id: member.id,
        target_email: member.email,
        title: 'Promemoria Evento',
        message: `Ciao ${member.first_name},\n\nTi ricordiamo che domani ${new Date(event.start_time).toLocaleDateString('it-IT')} alle ${new Date(event.start_time).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })} ci sarà: ${event.title}\n\n${event.location ? `Luogo: ${event.location}\n` : ''}${event.description ? `Descrizione: ${event.description}\n` : ''}\nSquadra: ${member.team_name}\n\nTi aspettiamo!\nCS Roma`,
        trigger_date: today,
        target_data: {
          event_id: event.id,
          event_title: event.title,
          event_date: event.start_time,
          team_name: member.team_name
        }
      }

      // Check if notification already sent
      const { data: existingNotification } = await supabase
        .from('pending_notifications')
        .select('id')
        .eq('type', 'event_reminder')
        .eq('target_user_id', member.id)
        .eq('trigger_date', today)
        .single()

      if (!existingNotification) {
        await supabase
          .from('pending_notifications')
          .insert([notification])

        // Send notification immediately
        await sendNotification(notification)
      }
    }
  }
}

async function sendNotification(notification: any) {
  try {
    // For now, we'll create a message in the messages system
    // In a real implementation, you would send email here
    const supabase = createClient()
    
    // Create a message for the user
    const { data: messageData, error: messageError } = await supabase
      .from('messages')
      .insert([{
        subject: notification.title,
        content: notification.message,
        created_by: '00000000-0000-0000-0000-000000000000' // System user
      }])
      .select()
      .single()

    if (messageError) throw messageError

    // Create message recipient
    const { error: recipientError } = await supabase
      .from('message_recipients')
      .insert([{
        message_id: messageData.id,
        profile_id: notification.target_user_id,
        is_read: false
      }])

    if (recipientError) throw recipientError

    // Mark notification as sent
    await supabase
      .from('pending_notifications')
      .update({ sent_at: new Date().toISOString() })
      .eq('target_user_id', notification.target_user_id)
      .eq('type', notification.type)
      .eq('trigger_date', notification.trigger_date)

    console.log(`Notification sent to ${notification.target_email}: ${notification.title}`)
  } catch (error) {
    console.error('Error sending notification:', error)
  }
}

// Manual notification trigger (for testing or admin use)
export async function sendManualNotification(
  targetUserId: string,
  title: string,
  message: string
) {
  const supabase = createClient()
  
  try {
    const notification = {
      type: 'manual',
      target_user_id: targetUserId,
      title,
      message,
      trigger_date: new Date().toISOString().split('T')[0],
      target_data: {}
    }

    await sendNotification(notification)
    return { success: true }
  } catch (error) {
    console.error('Error sending manual notification:', error)
    return { success: false, error }
  }
}

// Get notification statistics
export async function getNotificationStats() {
  const supabase = createClient()
  
  try {
    const { data: totalSent } = await supabase
      .from('pending_notifications')
      .select('*', { count: 'exact' })
      .not('sent_at', 'is', null)

    const { data: pendingCount } = await supabase
      .from('pending_notifications')
      .select('*', { count: 'exact' })
      .is('sent_at', null)

    const { data: todayCount } = await supabase
      .from('pending_notifications')
      .select('*', { count: 'exact' })
      .eq('trigger_date', new Date().toISOString().split('T')[0])

    return {
      totalSent: totalSent?.length || 0,
      pending: pendingCount?.length || 0,
      today: todayCount?.length || 0
    }
  } catch (error) {
    console.error('Error getting notification stats:', error)
    return { totalSent: 0, pending: 0, today: 0 }
  }
}
