'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { DocumentTemplate } from './DocumentsManager'

export default function TemplateModal({
  mode,
  initialTemplate,
  onClose,
  onSaved,
}:{
  mode: 'create' | 'edit'
  initialTemplate?: DocumentTemplate
  onClose: () => void
  onSaved: () => Promise<void> | void
}) {
  const supabase = createClient()
  const [name, setName] = useState('')
  const [targetType, setTargetType] = useState<'user'|'team'>('team')
  const [includeLogo, setIncludeLogo] = useState<boolean>(true)
  const [contentHtml, setContentHtml] = useState<string>('')

  useEffect(() => {
    if (initialTemplate) {
      setName(initialTemplate.name || '')
      setTargetType(initialTemplate.target_type)
      // Il DB usa la colonna has_logo; lato UI manteniamo "include_logo"
      setIncludeLogo(!!initialTemplate.include_logo)
      setContentHtml(initialTemplate.content_html || '')
    }
  }, [initialTemplate])

  async function handleSubmit() {
    if (!name.trim()) { alert('Inserisci un nome'); return }
    if (!contentHtml.trim()) { alert('Inserisci il contenuto HTML'); return }

    if (mode === 'create') {
      const { error } = await supabase.from('document_templates').insert({
        name,
        target_type: targetType,
        // Mapping corretto: la colonna è has_logo
        has_logo: includeLogo,
        content_html: contentHtml,
      })
      if (error) { alert('Errore creazione template'); return }
    } else {
      const { error } = await supabase
        .from('document_templates')
        .update({
          name,
          target_type: targetType,
          // Mapping corretto: la colonna è has_logo
          has_logo: includeLogo,
          content_html: contentHtml,
        })
        .eq('id', initialTemplate!.id)
      if (error) { alert('Errore salvataggio template'); return }
    }
    await onSaved()
  }

  return (
    <div className="cs-overlay" aria-hidden="false">
      <div className="cs-modal cs-modal--xl" data-state="open">
        <div className="mb-4">
          <h3 className="cs-modal__title">{mode === 'create' ? 'Nuovo Template' : 'Modifica Template'}</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-1 space-y-3">
            <div>
              <label className="cs-field__label">Nome *</label>
              <input className="cs-input" value={name} onChange={e => setName(e.target.value)} placeholder="Convocazioni" />
            </div>
            <div>
              <label className="cs-field__label">Target *</label>
              <select className="cs-select" value={targetType} onChange={e => setTargetType(e.target.value as any)}>
                <option value="team">Team</option>
                <option value="user">Utente</option>
              </select>
            </div>
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" checked={includeLogo} onChange={e => setIncludeLogo(e.target.checked)} />
              <span>Includi logo</span>
            </label>
          </div>

          <div className="md:col-span-2">
            <label className="cs-field__label">Contenuto HTML *</label>
            <textarea className="cs-textarea" rows={16} value={contentHtml} onChange={e => setContentHtml(e.target.value)} placeholder={`Esempio (Convocazioni - team):\n\n<h2 style="text-align:center">Convocazione</h2>\n<p><strong>{{team_name}}</strong> — {{today}}</p>\n{{athletes_list}}`}>
            </textarea>
            <p className="text-xs text-secondary mt-2">
              Placeholder utili: <code>&#123;&#123;today&#125;&#125;</code>, <code>&#123;&#123;team_name&#125;&#125;</code>, <code>&#123;&#123;athletes_list&#125;&#125;</code>, <code>&#123;&#123;athletes_table&#125;&#125;</code>, <code>&#123;&#123;first_name&#125;&#125;</code>, <code>&#123;&#123;last_name&#125;&#125;</code>
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <button className="cs-btn cs-btn--outline" onClick={onClose}>Annulla</button>
          <button className="cs-btn cs-btn--primary" onClick={handleSubmit}>
            {mode === 'create' ? 'Crea template' : 'Salva modifiche'}
          </button>
        </div>
      </div>
    </div>
  )
}
