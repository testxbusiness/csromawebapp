'use client'

import { useMemo } from 'react'
import { sanitizeHtml } from '@/lib/utils/sanitizeHtml'

export default function PreviewModal({ html, onClose }:{ html: string; onClose: ()=>void }) {
  const safeHtml = useMemo(() => sanitizeHtml(html), [html])

  return (
    <div className="cs-overlay" aria-hidden="false">
      <div className="cs-modal cs-modal--xl" data-state="open">
        <div className="mb-3">
          <h3 className="cs-modal__title">Anteprima Documento</h3>
        </div>
        <div className="cs-card p-4 prose max-w-none" dangerouslySetInnerHTML={{ __html: safeHtml }} />
        <div className="flex justify-end gap-2 mt-4">
          <button className="cs-btn cs-btn--primary" onClick={onClose}>Chiudi</button>
        </div>
      </div>
    </div>
  )
}
