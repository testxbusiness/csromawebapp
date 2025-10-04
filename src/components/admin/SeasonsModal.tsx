'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

interface Season {
  id?: string
  name: string
  start_date: string
  end_date: string
  is_active: boolean
  created_at?: string
  updated_at?: string
}

interface SeasonsModalProps {
  season?: Season | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: Omit<Season, 'id'>) => void
  trigger?: React.ReactNode
}

export function SeasonsModal({
  season,
  open,
  onOpenChange,
  onSubmit,
  trigger
}: SeasonsModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    start_date: '',
    end_date: '',
    is_active: false
  })

  useEffect(() => {
    if (season) {
      setFormData({
        name: season.name || '',
        start_date: season.start_date ? new Date(season.start_date).toISOString().split('T')[0] : '',
        end_date: season.end_date ? new Date(season.end_date).toISOString().split('T')[0] : '',
        is_active: season.is_active || false
      })
    } else {
      setFormData({
        name: '',
        start_date: '',
        end_date: '',
        is_active: false
      })
    }
  }, [season, open])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit({
      ...formData,
      start_date: new Date(formData.start_date).toISOString(),
      end_date: new Date(formData.end_date).toISOString()
    })
    onOpenChange(false)
  }

  const isEditing = !!season?.id

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="cs-modal--centered sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Modifica Stagione' : 'Nuova Stagione'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="cs-field__label">
              Nome Stagione
            </label>
            <Input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Es: Stagione 2024/2025"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="cs-field__label">
                Data Inizio
              </label>
              <Input
                type="date"
                required
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
              />
            </div>

            <div>
              <label className="cs-field__label">
                Data Fine
              </label>
              <Input
                type="date"
                required
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
              />
            </div>
          </div>

          {!season?.is_active && (
            <div className="flex items-center">
              <input
                type="checkbox"
                id="is_active"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="h-4 w-4 text-[color:var(--cs-primary)] focus:ring-[color:var(--cs-primary)] border-[color:var(--cs-border)] rounded"
              />
              <label htmlFor="is_active" className="ml-2 block text-sm text-[color:var(--cs-text)]">
                Imposta come stagione attiva
              </label>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Annulla
            </Button>
            <Button type="submit">
              {isEditing ? 'Aggiorna' : 'Crea'} Stagione
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}