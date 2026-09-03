import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { ResponsiveDetail, Table } from '@/components/ui'

type AdminManagementPageProps = {
  title: ReactNode
  description?: ReactNode
  context?: ReactNode
  primaryAction?: ReactNode
  filters?: ReactNode
  summary?: ReactNode
  children: ReactNode
  className?: string
}

/** Common composition for admin CRUD pages. Domain managers own data and mutations. */
export function AdminManagementPage({ title, description, context, primaryAction, filters, summary, children, className }: AdminManagementPageProps) {
  return (
    <div className={cn('cs-admin-management space-y-5', className)}>
      <header className="cs-admin-management__header">
        <div className="min-w-0">
          {context ? <p className="cs-admin-management__context">{context}</p> : null}
          <h1 className="cs-type-h1">{title}</h1>
          {description ? <p className="cs-admin-management__description">{description}</p> : null}
        </div>
        {primaryAction ? <div className="cs-admin-management__action">{primaryAction}</div> : null}
      </header>
      {filters ? <div className="cs-admin-management__filters" aria-label="Ricerca e filtri">{filters}</div> : null}
      {summary ? <div className="cs-admin-management__summary">{summary}</div> : null}
      <section aria-label={typeof title === 'string' ? title : 'Elenco elementi'}>{children}</section>
    </div>
  )
}

type AdminDataTableProps = React.ComponentProps<typeof Table> & { caption?: string; children: ReactNode }

export function AdminDataTable({ caption, className, children, ...props }: AdminDataTableProps) {
  return (
    <div className="cs-admin-table-wrap">
      <Table className={cn('cs-admin-table', className)} {...props}>
        {caption ? <caption className="visually-hidden">{caption}</caption> : null}
        {children}
      </Table>
    </div>
  )
}

type AdminSelectionBarProps = {
  selectedCount: number
  totalCount?: number
  onClear: () => void
  children?: ReactNode
}

export function AdminSelectionBar({ selectedCount, totalCount, onClear, children }: AdminSelectionBarProps) {
  if (selectedCount === 0) return null
  return (
    <div className="cs-admin-selection-bar" role="region" aria-label="Azioni sugli elementi selezionati" aria-live="polite">
      <span><strong>{selectedCount}</strong>{totalCount ? ` di ${totalCount}` : ''} selezionati</span>
      <div className="cs-admin-selection-bar__actions">
        {children}
        <button type="button" className="cs-btn cs-btn--ghost cs-btn--sm" onClick={onClear}>Deseleziona</button>
      </div>
    </div>
  )
}

type AdminRowCheckboxProps = {
  id: string
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
}

export function AdminRowCheckbox({ id, checked, onChange, label }: AdminRowCheckboxProps) {
  return (
    <label className="cs-admin-row-checkbox">
      <input id={id} type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span className="visually-hidden">{label}</span>
    </label>
  )
}

type AdminDetailDrawerProps = React.ComponentProps<typeof ResponsiveDetail>

export function AdminDetailDrawer(props: AdminDetailDrawerProps) {
  return <ResponsiveDetail {...props} className={cn('cs-admin-detail-drawer', props.className)} />
}
