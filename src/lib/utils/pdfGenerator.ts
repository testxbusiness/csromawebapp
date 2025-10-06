// PDF generation utility using jsPDF
// Note: You'll need to install jsPDF and html2canvas
// npm install jspdf html2canvas

export interface PDFGenerationOptions {
  title: string
  content: string
  styles?: string
  hasLogo?: boolean
  logoPosition?: 'top-left' | 'top-center' | 'top-right'
  hasDate?: boolean
  dateFormat?: string
  hasSignatureArea?: boolean
  footerText?: string
}

export interface GeneratedPDF {
  blob: Blob
  url: string
  filename: string
}

// Generate PDF from HTML content
export async function generatePDF(options: PDFGenerationOptions): Promise<GeneratedPDF> {
  // Try dynamic, client-side generation using CDN jsPDF + html2canvas
  async function loadScript(src: string) {
    await new Promise<void>((resolve, reject) => {
      const s = document.createElement('script')
      s.src = src
      s.async = true
      s.onload = () => resolve()
      s.onerror = () => reject(new Error('Failed to load ' + src))
      document.body.appendChild(s)
    })
  }

  try {
    const hasHtml2Canvas = (window as any).html2canvas
    const hasJsPDF = (window as any).jspdf?.jsPDF
    if (!hasHtml2Canvas) {
      await loadScript('https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js')
    }
    if (!hasJsPDF) {
      await loadScript('https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js')
    }

    const html2canvas = (window as any).html2canvas as (el: HTMLElement, opts?: any) => Promise<HTMLCanvasElement>
    const { jsPDF } = (window as any).jspdf

    const wrapper = document.createElement('div')
    wrapper.style.position = 'fixed'
    wrapper.style.left = '-10000px'
    wrapper.style.top = '0'
    wrapper.style.width = '794px' // ~A4 at 96dpi
    wrapper.style.background = '#fff'
    wrapper.innerHTML = createHTMLDocument(options)
    document.body.appendChild(wrapper)

    const canvas = await html2canvas(wrapper, { scale: 2, useCORS: true })
    document.body.removeChild(wrapper)
    const imgData = canvas.toDataURL('image/jpeg', 0.95)

    const pdf = new jsPDF('p', 'pt', 'a4')
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()

    const ratio = canvas.height / canvas.width
    const imgWidth = pageWidth
    let imgHeight = imgWidth * ratio
    let y = 0
    // If content spans multiple pages, add more pages slicing the image vertically
    if (imgHeight <= pageHeight) {
      pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, imgHeight)
    } else {
      let position = 0
      const sliceHeight = pageHeight
      while (position < imgHeight) {
        pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, imgHeight, undefined, 'FAST')
        position += sliceHeight
        if (position < imgHeight) pdf.addPage()
      }
    }

    const blob = pdf.output('blob') as Blob
    const url = URL.createObjectURL(blob)
    const filename = `${options.title.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}.pdf`
    return { blob, url, filename }
  } catch (e) {
    console.warn('Falling back to HTML document for PDF generation:', e)
    const htmlContent = createHTMLDocument(options)
    const blob = new Blob([htmlContent], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const filename = `${options.title.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}.html`
    return { blob, url, filename }
  }
}

function createHTMLDocument(options: PDFGenerationOptions): string {
  const currentDate = new Date().toLocaleDateString('it-IT', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  return `
<!DOCTYPE html>
<html lang="it">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${options.title}</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
        }
        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 30px;
            border-bottom: 2px solid #003366;
            padding-bottom: 10px;
        }
        .logo {
            font-size: 24px;
            font-weight: bold;
            color: #003366;
        }
        .date {
            font-size: 14px;
            color: #666;
        }
        .content {
            margin: 30px 0;
            min-height: 400px;
        }
        .signature-area {
            margin-top: 50px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
        }
        .signature-line {
            margin-top: 40px;
            border-bottom: 1px solid #333;
            width: 200px;
            padding-bottom: 5px;
        }
        .footer {
            margin-top: 50px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
            text-align: center;
            font-size: 12px;
            color: #666;
        }
        h1, h2, h3 {
            color: #003366;
        }
        h1 {
            text-align: center;
            margin-bottom: 30px;
        }
        .document {
            padding: 20px;
        }
        ${options.styles || ''}
    </style>
</head>
<body>
    <div class="header">
        ${options.hasLogo ? `<div class="logo">CS ROMA</div>` : '<div></div>'}
        ${options.hasDate ? `<div class="date">${currentDate}</div>` : '<div></div>'}
    </div>
    
    <div class="content">
        ${options.content}
    </div>
    
    ${options.hasSignatureArea ? `
    <div class="signature-area">
        <p><strong>Firma:</strong></p>
        <div class="signature-line"></div>
        <p style="margin-top: 5px; font-size: 12px;">Firma del richiedente</p>
    </div>
    ` : ''}
    
    ${options.footerText ? `
    <div class="footer">
        ${options.footerText}
    </div>
    ` : ''}
</body>
</html>
  `
}

// Convert variables in template
export function replaceTemplateVariables(
  template: string, 
  variables: Record<string, any>
): string {
  let result = template
  
  Object.entries(variables).forEach(([key, value]) => {
    const placeholder = new RegExp(`{{${key}}}`, 'g')
    result = result.replace(placeholder, String(value || ''))
  })
  
  return result
}

// Get available template variables based on context
export function getTemplateVariables(context: 'user' | 'team'): Record<string, string> {
  const commonVariables = {
    current_date: 'Data corrente',
    current_year: 'Anno corrente',
    season_name: 'Nome stagione attiva',
    association_name: 'Nome associazione'
  }

  const userVariables = {
    user_first_name: 'Nome utente',
    user_last_name: 'Cognome utente', 
    user_full_name: 'Nome completo utente',
    user_email: 'Email utente',
    user_phone: 'Telefono utente',
    user_birth_date: 'Data di nascita',
    user_title: 'Titolo (Sig./Sig.ra/Dott.)',
    medical_certificate_expiry: 'Scadenza certificato medico',
    jersey_number: 'Numero maglia',
    membership_number: 'Numero tessera'
  }

  const teamVariables = {
    team_name: 'Nome squadra',
    team_code: 'Codice squadra',
    activity_name: 'Nome attività',
    coach_name: 'Nome allenatore',
    coach_email: 'Email allenatore',
    gym_name: 'Nome palestra',
    gym_address: 'Indirizzo palestra'
  }

  const eventVariables = {
    event_title: 'Titolo evento',
    event_description: 'Descrizione evento',
    event_date: 'Data evento',
    event_time: 'Ora evento',
    event_location: 'Luogo evento'
  }

  if (context === 'user') {
    return { ...commonVariables, ...userVariables }
  } else {
    return { ...commonVariables, ...teamVariables, ...eventVariables }
  }
}

// Bulk document generation
export async function generateBulkDocuments(
  template: any,
  recipients: any[],
  getVariablesForRecipient: (recipient: any) => Record<string, any>
): Promise<GeneratedPDF[]> {
  const results: GeneratedPDF[] = []
  
  for (const recipient of recipients) {
    try {
      const variables = getVariablesForRecipient(recipient)
      const content = replaceTemplateVariables(template.content_html, variables)
      
      const pdf = await generatePDF({
        title: `${template.name} - ${variables.user_full_name || variables.team_name}`,
        content,
        styles: template.styles_css,
        hasLogo: template.has_logo,
        logoPosition: template.logo_position,
        hasDate: template.has_date,
        hasSignatureArea: template.has_signature_area,
        footerText: template.footer_text
      })
      
      results.push(pdf)
    } catch (error) {
      console.error(`Error generating document for recipient:`, error)
    }
  }
  
  return results
}

// Save generated PDF to Supabase Storage
export async function savePDFToStorage(
  supabase: any,
  pdf: GeneratedPDF,
  bucket: string = 'documents'
): Promise<string | null> {
  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(`generated/${pdf.filename}`, pdf.blob, {
        contentType: 'application/pdf',
        upsert: false
      })

    if (error) throw error

    const { data: urlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(data.path)

    return urlData.publicUrl
  } catch (error) {
    console.error('Error saving PDF to storage:', error)
    return null
  }
}

// Download generated PDF
export function downloadPDF(pdf: GeneratedPDF) {
  const link = document.createElement('a')
  link.href = pdf.url
  link.download = pdf.filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(pdf.url)
}

// Preview PDF in new window
export function previewPDF(pdf: GeneratedPDF) {
  const newWindow = window.open(pdf.url, '_blank')
  if (!newWindow) {
    alert('Popup bloccato! Abilita i popup per visualizzare l\'anteprima.')
  }
}

// Email PDF (placeholder - would integrate with email service)
export async function emailPDF(
  pdf: GeneratedPDF,
  recipient: string,
  subject: string,
  message: string
): Promise<boolean> {
  try {
    // This would integrate with an email service like SendGrid, Resend, etc.
    console.log('Sending PDF via email:', {
      to: recipient,
      subject,
      message,
      attachment: pdf.filename
    })
    
    // For now, return success
    return true
  } catch (error) {
    console.error('Error sending PDF via email:', error)
    return false
  }
}
