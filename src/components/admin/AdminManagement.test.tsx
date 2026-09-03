import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import { AdminDataTable, AdminManagementPage, AdminRowCheckbox, AdminSelectionBar } from './AdminManagement'

describe('Admin management pattern', () => {
  it('composes context, action, filters, summary and content slots', () => {
    render(
      <AdminManagementPage title="Persone" context="Anagrafica" description="Gestisci le persone" primaryAction={<button>Nuova persona</button>} filters={<input aria-label="Cerca persone" />} summary={<span>12 persone</span>}>
        <AdminDataTable caption="Persone">
          <tbody><tr><td>Mario Rossi</td></tr></tbody>
        </AdminDataTable>
      </AdminManagementPage>,
    )

    expect(screen.getByRole('heading', { name: 'Persone' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Nuova persona' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Cerca persone' })).toBeInTheDocument()
    expect(screen.getByRole('table', { name: 'Persone' })).toBeInTheDocument()
  })

  it('exposes accessible bulk selection and allows clearing it', () => {
    const onClear = jest.fn()
    render(<AdminSelectionBar selectedCount={2} totalCount={8} onClear={onClear}><button>Archivia</button></AdminSelectionBar>)
    expect(screen.getByRole('region', { name: 'Azioni sugli elementi selezionati' })).toHaveTextContent('2 di 8 selezionati')
    screen.getByRole('button', { name: 'Deseleziona' }).click()
    expect(onClear).toHaveBeenCalledTimes(1)
  })

  it('keeps row selection labelled for assistive technology', () => {
    render(<AdminRowCheckbox id="person-1" checked={false} onChange={jest.fn()} label="Seleziona Mario Rossi" />)
    expect(screen.getByRole('checkbox', { name: 'Seleziona Mario Rossi' })).toBeInTheDocument()
  })
})
