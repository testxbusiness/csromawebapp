import { createClient } from '@/lib/supabase/client'

export interface EmailOptions {
  to: string
  subject: string
  html: string
  text?: string
}

// Email templates
export const emailTemplates = {
  welcome: (firstName: string, resetLink: string, tempPassword?: string) => ({
    subject: 'Benvenuto in CSRoma - Imposta la tua password',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .button { background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; }
          .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #6b7280; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>CSRoma</h1>
            <p>Gestione Società Sportiva</p>
          </div>
          <div class="content">
            <h2>Benvenuto/a ${firstName}!</h2>
            <p>Il tuo account è stato creato con successo sulla piattaforma CSRoma.</p>
            
            ${tempPassword ? `
            <p><strong>Password temporanea:</strong> ${tempPassword}</p>
            <p>Ti consigliamo di cambiare questa password al primo accesso.</p>
            ` : ''}
            
            <p>Per accedere alla piattaforma e impostare la tua password, clicca sul pulsante qui sotto:</p>
            
            <p style="text-align: center; margin: 30px 0;">
              <a href="${resetLink}" class="button">Imposta Password</a>
            </p>
            
            <p>Se il pulsante non funziona, copia e incolla questo link nel tuo browser:</p>
            <p style="word-break: break-all; color: #6b7280; font-size: 14px;">${resetLink}</p>
            
            <p>Questo link sarà valido per 24 ore.</p>
          </div>
          <div class="footer">
            <p>© 2024 CSRoma. Tutti i diritti riservati.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
Benvenuto/a ${firstName}!

Il tuo account è stato creato con successo sulla piattaforma CSRoma.

${tempPassword ? `Password temporanea: ${tempPassword}\nTi consigliamo di cambiare questa password al primo accesso.\n` : ''}
Per accedere alla piattaforma e impostare la tua password, visita:
${resetLink}

Questo link sarà valido per 24 ore.

© 2024 CSRoma. Tutti i diritti riservati.
    `
  }),
  
  passwordReset: (firstName: string, resetLink: string) => ({
    subject: 'Reimposta la tua password CSRoma',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .button { background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; }
          .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #6b7280; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>CSRoma</h1>
            <p>Gestione Società Sportiva</p>
          </div>
          <div class="content">
            <h2>Reimposta Password</h2>
            <p>Ciao ${firstName},</p>
            <p>Abbiamo ricevuto una richiesta per reimpostare la password del tuo account CSRoma.</p>
            
            <p style="text-align: center; margin: 30px 0;">
              <a href="${resetLink}" class="button">Reimposta Password</a>
            </p>
            
            <p>Se il pulsante non funziona, copia e incolla questo link nel tuo browser:</p>
            <p style="word-break: break-all; color: #6b7280; font-size: 14px;">${resetLink}</p>
            
            <p>Se non hai richiesto il reset della password, ignora questa email.</p>
            <p>Questo link sarà valido per 1 ora.</p>
          </div>
          <div class="footer">
            <p>© 2024 CSRoma. Tutti i diritti riservati.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
Reimposta Password

Ciao ${firstName},

Abbiamo ricevuto una richiesta per reimpostare la password del tuo account CSRoma.

Per reimpostare la password, visita:
${resetLink}

Se non hai richiesto il reset della password, ignora questa email.
Questo link sarà valido per 1 ora.

© 2024 CSRoma. Tutti i diritti riservati.
    `
  })
}

// Email service using Supabase Edge Functions (recommended)
export async function sendEmail(options: EmailOptions): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createClient()
    
    // Method 1: Supabase Edge Functions (preferred)
    // This requires setting up an edge function for email sending
    const { error } = await supabase.functions.invoke('send-email', {
      body: options
    })
    
    if (error) {
      console.error('Error sending email via edge function:', error)
      
      // Fallback to direct API if edge function not available
      return await sendEmailDirect(options)
    }
    
    return { success: true }
    
  } catch (error) {
    console.error('Error in sendEmail:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

// Direct email sending (fallback method)
async function sendEmailDirect(options: EmailOptions): Promise<{ success: boolean; error?: string }> {
  try {
    // This is a placeholder for your email service integration
    // You can integrate with Resend, SendGrid, Mailgun, etc.
    
    const emailService = process.env.EMAIL_SERVICE || 'resend'
    
    switch (emailService) {
      case 'resend':
        return await sendWithResend(options)
      case 'sendgrid':
        return await sendWithSendGrid(options)
      case 'mailgun':
        return await sendWithMailgun(options)
      default:
        // For development, just log the email
        console.log('\n=== EMAIL (Development Mode) ===')
        console.log('To:', options.to)
        console.log('Subject:', options.subject)
        console.log('Text:', options.text || 'No text version')
        console.log('===============================\n')
        return { success: true }
    }
  } catch (error) {
    console.error('Error in sendEmailDirect:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

// Placeholder implementations for email services
async function sendWithResend(options: EmailOptions): Promise<{ success: boolean; error?: string }> {
  // Implementation for Resend.com
  // Requires: npm install resend
  // And set: RESEND_API_KEY=your_api_key
  
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY not set, logging email instead')
    console.log('Resend email:', { to: options.to, subject: options.subject })
    return { success: true }
  }
  
  // Actual Resend implementation would go here
  return { success: true }
}

async function sendWithSendGrid(options: EmailOptions): Promise<{ success: boolean; error?: string }> {
  // Implementation for SendGrid
  return { success: true }
}

async function sendWithMailgun(options: EmailOptions): Promise<{ success: boolean; error?: string }> {
  // Implementation for Mailgun
  return { success: true }
}

// Generate password reset link
export function generateResetLink(email: string, token?: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  
  if (token) {
    // For actual password reset with token
    return `${baseUrl}/reset-password?token=${token}&email=${encodeURIComponent(email)}`
  } else {
    // For welcome email (user needs to set password)
    return `${baseUrl}/reset-password?email=${encodeURIComponent(email)}`
  }
}

// Send welcome email to new users
export async function sendWelcomeEmail(
  email: string, 
  firstName: string, 
  tempPassword?: string
): Promise<{ success: boolean; error?: string }> {
  const resetLink = generateResetLink(email)
  const template = emailTemplates.welcome(firstName, resetLink, tempPassword)
  
  return await sendEmail({
    to: email,
    subject: template.subject,
    html: template.html,
    text: template.text
  })
}

// Send password reset email
export async function sendPasswordResetEmail(
  email: string, 
  firstName: string, 
  token: string
): Promise<{ success: boolean; error?: string }> {
  const resetLink = generateResetLink(email, token)
  const template = emailTemplates.passwordReset(firstName, resetLink)
  
  return await sendEmail({
    to: email,
    subject: template.subject,
    html: template.html,
    text: template.text
  })
}