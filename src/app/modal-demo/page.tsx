'use client'

import { useState } from 'react'
import Modal from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'

export default function ModalDemoPage() {
  const [openDefault, setOpenDefault] = useState(false)
  const [openDanger, setOpenDanger] = useState(false)
  const [openMobile, setOpenMobile] = useState(false)

  return (
    <div className="max-w-3xl mx-auto py-12 space-y-8">
      <h1 className="text-2xl font-bold mb-6">Modal Playground</h1>

      {/* Default modal */}
      <Button onClick={() => setOpenDefault(true)}>Apri modal base</Button>
      <Modal
        open={openDefault}
        onOpenChange={setOpenDefault}
        title="Modal base"
        description="Questo è un esempio di modal standard."
        footer={
          <>
            <Button variant="outline" onClick={() => setOpenDefault(false)}>Chiudi</Button>
            <Button>Conferma</Button>
          </>
        }
      >
        <p>Corpo del modal con testo semplice.</p>
      </Modal>

      {/* Danger modal */}
      <Button variant="danger" onClick={() => setOpenDanger(true)}>Apri modal danger</Button>
      <Modal
        open={openDanger}
        onOpenChange={setOpenDanger}
        title="Elimina elemento"
        description="Questa azione non può essere annullata."
        variant="danger"
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setOpenDanger(false)}>Annulla</Button>
            <Button variant="danger">Elimina</Button>
          </>
        }
      >
        <p>Sei sicuro di voler eliminare questo elemento?</p>
      </Modal>

      {/* Fullscreen on mobile */}
      <Button variant="accent" onClick={() => setOpenMobile(true)}>Apri modal mobile</Button>
      <Modal
        open={openMobile}
        onOpenChange={setOpenMobile}
        title="Filtri avanzati"
        description="Su mobile si apre fullscreen."
        fullscreenOnMobile
        footer={
          <Button onClick={() => setOpenMobile(false)}>Applica</Button>
        }
      >
        <p>Contenuti del filtro…</p>
      </Modal>
    </div>
  )
}
