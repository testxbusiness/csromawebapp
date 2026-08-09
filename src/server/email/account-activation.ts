import 'server-only'

type AccountActivationEmailInput = {
  to: string
  firstName: string
  activationLink: string
}

type AccountActivationEmailResult =
  | { sent: true }
  | { sent: false; code: 'not_configured' | 'provider_error'; error: string }

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

export async function sendAccountActivationEmail({
  to,
  firstName,
  activationLink,
}: AccountActivationEmailInput): Promise<AccountActivationEmailResult> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM

  if (!apiKey || !from) {
    return {
      sent: false,
      code: 'not_configured',
      error: 'Mailer non configurato: impostare RESEND_API_KEY e EMAIL_FROM.',
    }
  }

  const safeFirstName = escapeHtml(firstName)
  const safeActivationLink = escapeHtml(activationLink)

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: 'Attiva il tuo account CSRoma',
        html: `
          <div style="font-family:Arial,sans-serif;line-height:1.6;color:#17213a;max-width:600px;margin:0 auto">
            <h1>Benvenuto/a in CSRoma</h1>
            <p>Ciao ${safeFirstName},</p>
            <p>Il tuo account è stato predisposto. Usa il pulsante seguente per impostare la password e attivare l’accesso.</p>
            <p><a href="${safeActivationLink}" style="display:inline-block;background:#d71920;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none">Attiva account</a></p>
            <p>Se il pulsante non funziona, copia questo link nel browser:</p>
            <p style="word-break:break-all">${safeActivationLink}</p>
            <p>Se non riconosci questa richiesta, ignora l’email.</p>
          </div>
        `,
        text: `Ciao ${firstName}, attiva il tuo account CSRoma usando questo link: ${activationLink}`,
      }),
    })

    if (!response.ok) {
      return { sent: false, code: 'provider_error', error: `Provider email HTTP ${response.status}` }
    }

    return { sent: true }
  } catch (error) {
    return {
      sent: false,
      code: 'provider_error',
      error: error instanceof Error ? error.message : 'Errore provider email',
    }
  }
}
