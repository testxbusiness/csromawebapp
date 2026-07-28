import type { ImportColumn } from '@/lib/utils/excelImport'

export const matchImportColumns: Record<string, ImportColumn> = {
  giornata: { key: 'giornata', required: false, type: 'number' },
  data: { key: 'data', required: true, type: 'date' },
  ora: { key: 'ora', required: true, type: 'string' },
  casa: { key: 'casa', required: true, type: 'string' },
  casa_nome: { key: 'casa_nome', required: false, type: 'string' },
  ospiti: { key: 'ospiti', required: true, type: 'string' },
  ospiti_nome: { key: 'ospiti_nome', required: false, type: 'string' },
  luogo: { key: 'luogo', required: false, type: 'string' },
  note: { key: 'note', required: false, type: 'string' },
}

export const resultImportColumns: Record<string, ImportColumn> = {
  giornata: { key: 'giornata', required: true, type: 'number' },
  casa: { key: 'casa', required: true, type: 'string' },
  ospiti: { key: 'ospiti', required: true, type: 'string' },
  risultato_set: { key: 'risultato_set', required: false, type: 'string' },
  risultato: { key: 'risultato', required: false, type: 'string' },
}
