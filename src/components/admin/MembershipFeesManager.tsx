'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { exportToExcel } from '@/lib/utils/excelExport'
import MembershipFeeModal from '@/components/admin/MembershipFeeModal'

interface MembershipFee {
  id?: string
  team_id: string
  name: string
  description?: string
  total_amount: number
  enrollment_fee: number
  insurance_fee: number
  monthly_fee: number
  months_count: number
  installments_count: number
  created_by?: string
  created_at?: string
  updated_at?: string

  // Joined data
  teams?: {
    id: string
    name: string
    code: string
  }
  created_by_profile?: {
    first_name: string
    last_name: string
  }
  fee_installments?: {
    id: string
    profile_id: string
    installment_number: number
    due_date: string
    amount: number
    status: 'not_due' | 'due_soon' | 'overdue' | 'paid'
    paid_at?: string
    profiles?: {
      first_name: string
      last_name: string
    }
  }[]
  predefined_installments?: {
    id: string
    installment_number: number
    due_date: string
    amount: number
    description?: string
  }[]
}

interface Team {
  id: string
  name: string
  code: string
}

interface FeeInstallment {
  id: string
  membership_fee_id: string
  profile_id: string
  installment_number: number
  due_date: string
  amount: number
  status: 'not_due' | 'due_soon' | 'overdue' | 'paid'
  paid_at?: string
  profiles?: {
    first_name: string
    last_name: string
  }
}

export default function MembershipFeesManager() {
  const [fees, setFees] = useState<MembershipFee[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [tab, setTab] = useState<'fees'|'athletes'>('fees')
  const [loading, setLoading] = useState(true)
  const [editingFee, setEditingFee] = useState<MembershipFee | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [showInstallments, setShowInstallments] = useState<string | null>(null)
  const [editingInstallments, setEditingInstallments] = useState<Set<string>>(new Set())
  // Athletes tab state
  const [filterTeamId, setFilterTeamId] = useState<string>('')
  const [filterAthleteId, setFilterAthleteId] = useState<string>('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterFrom, setFilterFrom] = useState<string>('')
  const [filterTo, setFilterTo] = useState<string>('')
  const [teamAthletes, setTeamAthletes] = useState<{ id: string; first_name: string; last_name: string }[]>([])
  const [flatInstallments, setFlatInstallments] = useState<any[]>([])
  const [selectedInstallments, setSelectedInstallments] = useState<Set<string>>(new Set())
  const supabase = createClient()

  useEffect(() => {
    // All'apertura, ricalcola stati e poi carica dati
    (async () => {
      await recalcInstallmentStatuses(true)
      await loadFees()
    })()
    loadTeams()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadFees = async () => {
    try {
      const res = await fetch('/api/admin/membership-fees', { method: 'GET' })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Errore caricamento quote')
      setFees(json.fees || [])
    } catch (e) {
      console.error('Errore caricamento quote associative:', e)
      setFees([])
    } finally {
      setLoading(false)
    }
  }

  const loadTeams = async () => {
    const { data } = await supabase
      .from('teams')
      .select('id, name, code')
      .order('name')

    setTeams(data || [])
  }

  // Load athletes for team filter
  useEffect(() => {
    const run = async () => {
      if (!filterTeamId) { setTeamAthletes([]); setFilterAthleteId(''); return }
      const { data: tms } = await supabase
        .from('team_members')
        .select('profile_id')
        .eq('team_id', filterTeamId)
      const ids = [...new Set((tms||[]).map((r:any)=>r.profile_id))]
      if (ids.length === 0) { setTeamAthletes([]); setFilterAthleteId(''); return }
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, first_name, last_name')
        .in('id', ids)
      setTeamAthletes((profs||[]) as any)
    }
    run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterTeamId])

  const loadFlatInstallments = async () => {
    const params = new URLSearchParams()
    if (filterTeamId) params.set('team_id', filterTeamId)
    if (filterAthleteId) params.set('profile_id', filterAthleteId)
    if (filterStatus) params.set('status', filterStatus)
    if (filterFrom) params.set('from', filterFrom)
    if (filterTo) params.set('to', filterTo)
    const res = await fetch(`/api/admin/installments?${params.toString()}`)
    const json = await res.json()
    if (res.ok) setFlatInstallments(json.items || [])
    else {
      console.error('Errore caricamento rate per atleta:', json.error)
      setFlatInstallments([])
    }
    setSelectedInstallments(new Set())
  }

  const calculateTotalAmount = (formData: any) => {
    const toFloat = (v: any) => parseFloat((v ?? '0').toString().replace(',', '.')) || 0
    const enrollment = toFloat(formData.enrollment_fee)
    const insurance = toFloat(formData.insurance_fee)
    const monthly = toFloat(formData.monthly_fee)
    const months = toFloat(formData.months_count)
    return enrollment + insurance + (monthly * months)
  }

  const handleCreateFee = async (feeData: Omit<MembershipFee, 'id'> & { installments: InstallmentForm[] }) => {
    try {
      const response = await fetch('/api/admin/membership-fees', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...feeData,
          total_amount: calculateTotalAmount(feeData),
          installments: feeData.installments
        })
      })

      const result = await response.json()

      if (!response.ok) {
        console.error('Errore creazione quota:', result.error)
        alert(`Errore: ${result.error}`)
        return
      }

      setShowModal(false)
      setEditingFee(null)
      loadFees()
      alert(result.message || 'Quota creata con successo!')
    } catch (error) {
      console.error('Errore creazione quota:', error)
      alert('Errore di rete durante la creazione della quota')
    }
  }

  const handleUpdateFee = async (id: string, feeData: Partial<MembershipFee> & { installments?: InstallmentForm[] }) => {
    try {
      const updateData = { ...feeData }
      if (feeData.enrollment_fee !== undefined || feeData.insurance_fee !== undefined || 
          feeData.monthly_fee !== undefined || feeData.months_count !== undefined) {
        updateData.total_amount = calculateTotalAmount(feeData)
      }

      const response = await fetch('/api/admin/membership-fees', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id,
          ...updateData,
          installments: feeData.installments
        })
      })

      const result = await response.json()

      if (!response.ok) {
        console.error('Errore aggiornamento quota:', result.error)
        alert(`Errore: ${result.error}`)
        return
      }

      setShowModal(false)
      setEditingFee(null)
      loadFees()
      alert(result.message || 'Quota aggiornata con successo!')
    } catch (error) {
      console.error('Errore aggiornamento quota:', error)
      alert('Errore di rete durante l\'aggiornamento della quota')
    }
  }

  const handleDeleteFee = async (id: string) => {
    if (window.confirm('Sei sicuro di voler eliminare questa quota associativa?')) {
      const { error } = await supabase
        .from('membership_fees')
        .delete()
        .eq('id', id)

      if (!error) {
        loadFees()
      }
    }
  }

  const updateInstallmentStatus = async (installmentId: string, newStatus: string) => {
    try {
      const response = await fetch('/api/admin/membership-fees', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          installment_id: installmentId,
          status: newStatus,
          action: 'update_installment_status'
        })
      })

      const result = await response.json()

      if (!response.ok) {
        console.error('Errore aggiornamento stato rata:', result.error)
        alert(`Errore: ${result.error}`)
        return false
      }

      alert(result.message || 'Stato rata aggiornato con successo!')
      loadFees()
      return true
    } catch (error) {
      console.error('Errore aggiornamento stato rata:', error)
      alert('Errore di rete durante l\'aggiornamento dello stato rata')
      return false
    }
  }

  const bulkMarkPaid = async () => {
    if (selectedInstallments.size === 0) return
    const res = await fetch('/api/admin/membership-fees', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'bulk_update_installments', installment_ids: Array.from(selectedInstallments), status: 'paid' })
    })
    const json = await res.json()
    if (!res.ok) { alert(json.error || 'Errore bulk update'); return }
    await loadFlatInstallments()
    alert('Rate selezionate segnate come pagate')
  }

  const updateInstallmentDetails = async (installmentId: string, dueDate: string, amount: number) => {
    try {
      const requestBody = {
        installment_id: installmentId,
        due_date: dueDate,
        amount: amount,
        action: 'update_installment_details'
      }
      
      console.log('Invio richiesta PATCH:', requestBody)
      
      const response = await fetch('/api/admin/membership-fees', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      })

      const result = await response.json()
      console.log('Risposta API:', result)

      if (!response.ok) {
        console.error('Errore aggiornamento dettagli rata:', result.error)
        alert(`Errore: ${result.error}`)
        return false
      }

      alert(result.message || 'Dettagli rata aggiornati con successo!')
      loadFees()
      return true
    } catch (error) {
      console.error('Errore aggiornamento dettagli rata:', error)
      alert('Errore di rete durante l\'aggiornamento dei dettagli rata')
      return false
    }
  }

  const recalcInstallmentStatuses = async (silent = false) => {
    try {
      const res = await fetch('/api/admin/membership-fees', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'recalculate_installment_statuses' })
      })
      const json = await res.json()
      if (!res.ok) {
        if (!silent) alert(json.error || 'Errore durante il ricalcolo degli stati')
        return false
      }
      if (!silent) alert('Stati delle rate ricalcolati correttamente')
      return true
    } catch (e) {
      console.error(e)
      if (!silent) alert('Errore di rete durante il ricalcolo')
      return false
    }
  }

  const startEditingInstallment = (installmentId: string) => {
    setEditingInstallments(prev => new Set(prev).add(installmentId))
  }

  const cancelEditingInstallment = (installmentId: string) => {
    setEditingInstallments(prev => {
      const newSet = new Set(prev)
      newSet.delete(installmentId)
      return newSet
    })
  }

  const generateInstallments = async (feeId: string) => {
    try {
      const res = await fetch('/api/admin/membership-fees', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate_installments', fee_id: feeId })
      })
      const json = await res.json()
      if (!res.ok) {
        alert(json.error || 'Errore generazione rate')
        return false
      }
      await loadFees()
      return true
    } catch (e) {
      console.error('Errore generazione rate:', e)
      alert('Errore di rete durante la generazione rate')
      return false
    }
  }

  const saveInstallmentDetails = async (installment: FeeInstallment, newDueDate: string, newAmount: number) => {
    const success = await updateInstallmentDetails(installment.id, newDueDate, newAmount)
    if (success) {
      cancelEditingInstallment(installment.id)
    }
  }

  const exportFeesToExcel = () => {
    exportToExcel(fees, [
      { key: 'name', title: 'Nome Quota', width: 20 },
      { key: 'teams', title: 'Squadra', width: 15, format: (val) => val?.name || '' },
      { key: 'total_amount', title: 'Importo Totale', width: 12, format: (val) => `€${val.toFixed(2)}` },
      { key: 'enrollment_fee', title: 'Iscrizione', width: 10, format: (val) => `€${val.toFixed(2)}` },
      { key: 'insurance_fee', title: 'Assicurazione', width: 10, format: (val) => `€${val.toFixed(2)}` },
      { key: 'monthly_fee', title: 'Mensilità', width: 10, format: (val) => `€${val.toFixed(2)}` },
      { key: 'months_count', title: 'Mesi', width: 8 },
      { key: 'installments_count', title: 'Rate', width: 8 },
      { key: 'created_by_profile', title: 'Creato Da', width: 20, format: (val) => val ? `${val.first_name} ${val.last_name}` : '' },
      { key: 'created_at', title: 'Data Creazione', width: 15, format: (val) => new Date(val).toLocaleDateString('it-IT') }
    ], {
      filename: 'quote_associative_csroma',
      sheetName: 'Quote',
      headerStyle: { fill: { fgColor: { rgb: '27AE60' } } }
    })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-green-100 text-green-800'
      case 'due_soon': return 'bg-yellow-100 text-yellow-800'
      case 'overdue': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'paid': return 'Pagata'
      case 'due_soon': return 'In scadenza'
      case 'overdue': return 'Scaduta'
      default: return 'Non scaduta'
    }
  }

  if (loading) {
    return <div className="p-4">Caricamento quote associative...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Quote Associative</h2>
        <div className="flex gap-3">
          <button
            onClick={async () => {
              const ok = await recalcInstallmentStatuses(false)
              if (ok) await loadFees()
            }}
            className="bg-yellow-600 text-white px-4 py-2 rounded-lg hover:bg-yellow-700"
          >
            Ricalcola stati
          </button>
          <button
            onClick={exportFeesToExcel}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center"
          >
            <span className="mr-2">📊</span>
            Export Excel
          </button>
          <button
            onClick={() => {
              setEditingFee(null)
              setShowModal(true)
            }}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Nuova Quota
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button onClick={()=>setTab('fees')} className={`px-3 py-1 rounded ${tab==='fees'?'bg-blue-600 text-white':'bg-gray-100'}`}>Quote</button>
        <button onClick={()=>{setTab('athletes'); if (flatInstallments.length===0) loadFlatInstallments()}} className={`px-3 py-1 rounded ${tab==='athletes'?'bg-blue-600 text-white':'bg-gray-100'}`}>Atleti</button>
      </div>

      <MembershipFeeModal
  open={showModal}
  onClose={() => { setShowModal(false); setEditingFee(null) }}
  fee={editingFee}
  teams={teams}
  onCreate={handleCreateFee}
  onUpdate={handleUpdateFee}
/>

      {tab==='fees' ? (
      <div className="cs-card overflow-hidden">
        <table className="cs-table">
          <thead>
            <tr>
              <th>Nome Quota</th>
              <th>Squadra</th>
              <th>Importo Totale</th>
              <th>Dettagli</th>
              <th>Rate</th>
              <th>Azioni</th>
            </tr>
          </thead>
          <tbody>
            {fees.map((fee) => (
              <tr key={fee.id}>
                <td>
                  <div>
                    <div className="font-medium">{fee.name}</div>
                    <div className="text-secondary text-sm">{fee.description}</div>
                  </div>
                </td>
                <td>
                  <div>
                    {fee.teams?.name}
                  </div>
                  <div className="text-secondary text-xs">
                    {fee.teams?.code}
                  </div>
                </td>
                <td>
                  <div className="font-semibold">
                    €{fee.total_amount.toFixed(2)}
                  </div>
                </td>
                <td>
                  <div className="space-y-1">
                    <div>Iscrizione: €{fee.enrollment_fee.toFixed(2)}</div>
                    <div>Assicurazione: €{fee.insurance_fee.toFixed(2)}</div>
                    <div>Mensilità: €{fee.monthly_fee.toFixed(2)} × {fee.months_count} mesi</div>
                  </div>
                </td>
                <td>
                  <div>
                    {fee.predefined_installments?.length || 0} rate predefinite
                  </div>
                  <div className="cs-table__actions">
                    <button onClick={() => setShowInstallments(showInstallments === fee.id ? null : fee.id!)} className="cs-btn cs-btn--ghost cs-btn--sm">
                      {showInstallments === fee.id ? 'Nascondi' : 'Mostra'} rate
                    </button>
                    <button
                      onClick={() => generateInstallments(fee.id!)}
                      className="cs-btn cs-btn--primary cs-btn--sm"
                      title="Genera rate per gli atleti della squadra basandosi sulle rate predefinite"
                    >
                      Genera
                    </button>
                  </div>
                </td>
                <td className="cs-table__actions">
                  <button onClick={() => { setEditingFee(fee); setShowModal(true) }} className="cs-btn cs-btn--outline cs-btn--sm">Modifica</button>
                  <button onClick={() => handleDeleteFee(fee.id!)} className="cs-btn cs-btn--danger cs-btn--sm">Elimina</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {fees.length === 0 && (
          <div className="text-center py-8">
            <div className="text-secondary mb-3 text-3xl">💰</div>
            <h3 className="text-lg font-semibold mb-1">Nessuna quota associativa creata</h3>
            <p className="text-secondary mb-4">Crea la tua prima quota associativa per gestire i pagamenti delle squadre.</p>
            <button onClick={() => { setEditingFee(null); setShowModal(true) }} className="cs-btn cs-btn--primary">Crea la tua prima quota</button>
          </div>
        )}
      </div>
      ) : (
        <div className="cs-card p-4">
          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-4">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Squadra</label>
              <select value={filterTeamId} onChange={(e)=>setFilterTeamId(e.target.value)} className="w-full border rounded px-2 py-1">
                <option value="">Tutte</option>
                {teams.map(t=> <option key={t.id} value={t.id}>{t.name} ({t.code})</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Atleta</label>
              <select value={filterAthleteId} onChange={(e)=>setFilterAthleteId(e.target.value)} className="w-full border rounded px-2 py-1" disabled={!filterTeamId}>
                <option value="">Tutti</option>
                {teamAthletes.map(a=> <option key={a.id} value={a.id}>{a.first_name} {a.last_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Stato</label>
              <select value={filterStatus} onChange={(e)=>setFilterStatus(e.target.value)} className="w-full border rounded px-2 py-1">
                <option value="all">Tutti</option>
                <option value="not_due">Non scaduta</option>
                <option value="due_soon">In scadenza</option>
                <option value="overdue">Scaduta</option>
                <option value="paid">Pagata</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Da</label>
              <input type="date" value={filterFrom} onChange={(e)=>setFilterFrom(e.target.value)} className="w-full border rounded px-2 py-1" />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">A</label>
              <input type="date" value={filterTo} onChange={(e)=>setFilterTo(e.target.value)} className="w-full border rounded px-2 py-1" />
            </div>
          </div>
          <div className="flex gap-2 mb-3">
            <button onClick={loadFlatInstallments} className="cs-btn cs-btn--sm">Applica filtri</button>
            <button onClick={()=>{setFilterFrom(''); setFilterTo(''); setFilterStatus('all'); setFilterAthleteId(''); setFilterTeamId(''); setFlatInstallments([])}} className="cs-btn cs-btn--ghost cs-btn--sm">Reset</button>
            <button onClick={bulkMarkPaid} className="ml-auto cs-btn cs-btn--primary cs-btn--sm disabled:opacity-50" disabled={selectedInstallments.size===0}>Segna selezionate pagate</button>
          </div>

          <div className="overflow-x-auto">
            <table className="cs-table">
              <thead>
                <tr>
                  <th className="px-3 py-2"><input type="checkbox" onChange={(e)=>{
                    if (e.target.checked) setSelectedInstallments(new Set(flatInstallments.map((r:any)=>r.id)))
                    else setSelectedInstallments(new Set())
                  }} /></th>
                  <th>Atleta</th>
                  <th>Squadra</th>
                  <th>Quota</th>
                  <th>Rata</th>
                  <th>Scadenza</th>
                  <th>Importo</th>
                  <th>Stato</th>
                  <th>Azioni</th>
                </tr>
              </thead>
              <tbody>
                {flatInstallments.map((row:any)=> (
                  <tr key={row.id}>
                    <td className="px-3 py-2"><input type="checkbox" checked={selectedInstallments.has(row.id)} onChange={(e)=>{
                      setSelectedInstallments(prev => { const n = new Set(prev); if (e.target.checked) n.add(row.id); else n.delete(row.id); return n })
                    }} /></td>
                    <td className="px-3 py-2">{row.profile ? `${row.profile.first_name} ${row.profile.last_name}` : '—'}</td>
                    <td className="px-3 py-2">{row.team ? `${row.team.name} (${row.team.code})` : '—'}</td>
                    <td className="px-3 py-2">{row.membership_fee?.name || '—'}</td>
                    <td className="px-3 py-2">{row.installment_number}</td>
                    <td className="px-3 py-2">{new Date(row.due_date).toLocaleDateString('it-IT')}</td>
                    <td className="px-3 py-2">€{Number(row.amount).toFixed(2)}</td>
                    <td className="px-3 py-2"><span className={`cs-badge ${row.status==='paid'?'cs-badge--success': row.status==='overdue'?'cs-badge--danger': row.status==='due_soon'?'cs-badge--warning':'cs-badge--neutral'}`}>{getStatusText(row.status)}</span></td>
                    <td className="px-3 py-2">
                      {row.status !== 'paid' ? (
                        <button onClick={async ()=>{ const ok = await updateInstallmentStatus(row.id, 'paid'); if (ok) loadFlatInstallments() }} className="cs-btn cs-btn--primary cs-btn--sm">Segna pagata</button>
                      ) : (
                        <span className="text-xs text-secondary">Pagata {row.paid_at ? new Date(row.paid_at).toLocaleDateString('it-IT') : ''}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {flatInstallments.length === 0 && (
              <div className="text-center text-sm text-secondary py-8">Nessun risultato per i filtri correnti</div>
            )}
          </div>
        </div>
      )}

      {/* Installments Detail View */}
      {showInstallments && (
        <div className="bg-white rounded-lg shadow p-6 mt-4">
          <h3 className="text-lg font-semibold mb-4">Dettaglio Rate</h3>
          {(() => {
            const fee = fees.find(f => f.id === showInstallments)
            const installments = fee?.predefined_installments || []
            if (!fee) return null
            if (installments.length === 0) {
              return (
                <div className="p-4 bg-gray-50 border border-gray-200 rounded">
                  <p className="text-sm text-gray-600 mb-2">Nessuna rata predefinita trovata per questa quota.</p>
                  <p className="text-xs text-gray-500 mb-3">Definisci le rate predefinite nel form di modifica della quota.</p>
                  <button
                    onClick={() => {
                      setEditingFee(fee)
                      setShowModal(true)
                      setShowInstallments(null)
                    }}
                    className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
                  >
                    Modifica quota per definire le rate
                  </button>
                </div>
              )
            }
            return (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {installments.map((installment) => (
                  <div key={installment.id} className="border rounded-lg p-3">
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-semibold">Rata {installment.installment_number}</span>
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                        Predefinita
                      </span>
                    </div>

                    <div className="text-sm text-gray-600">
                      <div>Scadenza: {new Date(installment.due_date).toLocaleDateString('it-IT')}</div>
                      <div>Importo: €{installment.amount.toFixed(2)}</div>
                      {installment.description && (
                        <div className="text-xs text-gray-500 mt-1">{installment.description}</div>
                      )}
                    </div>
                  </div>
                ))}

                {/* Sezione rate assegnate agli atleti */}
                {fee.fee_installments && fee.fee_installments.length > 0 && (
                  <div className="col-span-full mt-6">
                    <h4 className="text-md font-semibold mb-3">Rate Assegnate agli Atleti</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {fee.fee_installments.map((installment) => (
                        <div key={installment.id} className="border rounded-lg p-3">
                          <div className="flex justify-between items-start mb-2">
                            <span className="font-semibold">Rata {installment.installment_number}</span>
                            <div className="flex items-center gap-2">
                              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs ${getStatusColor(installment.status)}`}>
                                {getStatusText(installment.status)}
                              </span>
                              <select
                                value={installment.status}
                                onChange={(e) => updateInstallmentStatus(installment.id, e.target.value)}
                                className="text-xs border rounded px-2 py-1"
                              >
                                <option value="not_due">Non scaduta</option>
                                <option value="due_soon">In scadenza</option>
                                <option value="overdue">Scaduta</option>
                                <option value="paid">Pagata</option>
                              </select>
                            </div>
                          </div>

                          <div className="text-sm text-gray-600">
                            <div>Scadenza: {new Date(installment.due_date).toLocaleDateString('it-IT')}</div>
                            <div>Importo: €{installment.amount.toFixed(2)}</div>
                            {installment.profiles && (
                              <div>Assegnata a: {installment.profiles.first_name} {installment.profiles.last_name}</div>
                            )}
                            {installment.paid_at && (
                              <div>Pagata il: {new Date(installment.paid_at).toLocaleDateString('it-IT')}</div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })()}
          <button
            onClick={() => setShowInstallments(null)}
            className="mt-4 px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
          >
            Chiudi
          </button>
        </div>
      )}
    </div>
  )
}

interface InstallmentForm {
  installment_number: number
  due_date: string
  amount: number
}

function FeeForm({ 
  fee, 
  teams,
  onSubmit, 
  onCancel 
}: { 
  fee: MembershipFee | null
  teams: Team[]
  onSubmit: (data: Omit<MembershipFee, 'id'> & { installments: InstallmentForm[] }) => void
  onCancel: () => void
}) {
  const supabase = createClient()
  const [formData, setFormData] = useState({
    team_id: fee?.team_id || '',
    name: fee?.name || '',
    description: fee?.description || '',
    enrollment_fee: fee?.enrollment_fee || 0,
    insurance_fee: fee?.insurance_fee || 0,
    monthly_fee: fee?.monthly_fee || 0,
    months_count: Number((fee?.months_count as any) ?? 0),
    installments_count: fee?.installments_count || 1
  })
  const [installments, setInstallments] = useState<InstallmentForm[]>(
    fee?.predefined_installments?.map(inst => ({
      installment_number: inst.installment_number,
      due_date: inst.due_date,
      amount: inst.amount
    })) || []
  )

  const calculatedTotal = formData.enrollment_fee + formData.insurance_fee + (formData.monthly_fee * formData.months_count)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const payload: any = { ...formData, installments }
    onSubmit(payload)
  }

  const handleNumberChange = (field: string, value: string) => {
    const normalized = value.replace(',', '.')
    const numValue = parseFloat(normalized) || 0
    setFormData(prev => ({ ...prev, [field]: numValue }))
  }


  const addInstallment = () => {
    const nextNumber = installments.length + 1
    const today = new Date()
    const dueDate = new Date(today)
    dueDate.setMonth(today.getMonth() + nextNumber)
    
    const installmentAmount = calculatedTotal / formData.installments_count
    
    setInstallments(prev => [
      ...prev,
      {
        installment_number: nextNumber,
        due_date: dueDate.toISOString().split('T')[0],
        amount: Math.round(installmentAmount * 100) / 100
      }
    ])
  }

  const removeInstallment = (index: number) => {
    setInstallments(prev => prev.filter((_, i) => i !== index))
  }

  const updateInstallment = (index: number, field: keyof InstallmentForm, value: string | number) => {
    setInstallments(prev => prev.map((inst, i) => 
      i === index ? { ...inst, [field]: value } : inst
    ))
  }

  const recalculateInstallments = () => {
    if (formData.installments_count > 0 && calculatedTotal > 0) {
      const today = new Date()

      const newInstallments = Array.from({ length: formData.installments_count }, (_, i) => {
        const existing = installments[i]
        const dueDate = new Date(today)
        dueDate.setMonth(today.getMonth() + i + 1)

        return {
          installment_number: i + 1,
          due_date: existing?.due_date || dueDate.toISOString().split('T')[0],
          amount: existing?.amount || 0
        }
      })

      setInstallments(newInstallments)
    }
  }

  useEffect(() => {
    recalculateInstallments()
  }, [formData.installments_count])

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold mb-4">
        {fee ? 'Modifica Quota' : 'Nuova Quota Associativa'}
      </h3>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Nome Quota *
          </label>
          <input
            type="text"
            required
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Es: Quota Under 15 2024/2025"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Descrizione
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Descrizione della quota (opzionale)"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Squadra *
          </label>
          <select
            value={formData.team_id}
            onChange={(e) => setFormData({ ...formData, team_id: e.target.value })}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Seleziona una squadra</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name} ({team.code})
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Quota Iscrizione (€)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={formData.enrollment_fee}
              onChange={(e) => handleNumberChange('enrollment_fee', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Quota Assicurazione (€)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={formData.insurance_fee}
              onChange={(e) => handleNumberChange('insurance_fee', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Mensilità (€)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={formData.monthly_fee}
              onChange={(e) => handleNumberChange('monthly_fee', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Numero Mesi
            </label>
            <input
              type="number"
              min="0"
              step="0.5"
              value={formData.months_count}
              onChange={(e) => handleNumberChange('months_count', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Numero Rate
            </label>
            <input
              type="number"
              min="1"
              value={formData.installments_count}
              onChange={(e) => handleNumberChange('installments_count', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>


        <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-blue-800">Importo Totale:</span>
            <span className="text-lg font-bold text-blue-800">
              €{calculatedTotal.toFixed(2)}
            </span>
          </div>
          <div className="text-xs text-blue-600 mt-1">
            (Iscrizione: €{formData.enrollment_fee.toFixed(2)} + 
            Assicurazione: €{formData.insurance_fee.toFixed(2)} + 
            Mensilità: €{formData.monthly_fee.toFixed(2)} × {formData.months_count} mesi)
          </div>
        </div>

        {/* Installments Management */}
        <div className="border-t border-gray-200 pt-4 mt-6">
          <h4 className="text-md font-semibold mb-3">Gestione Rate</h4>
          
          <div className="space-y-3">
            {installments.map((installment, index) => (
              <div key={index} className="flex items-center gap-3 p-3 border border-gray-200 rounded-md">
                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Rata {installment.installment_number} - Scadenza:
                    </label>
                    <input
                      type="date"
                      value={installment.due_date}
                      onChange={(e) => updateInstallment(index, 'due_date', e.target.value)}
                      className="w-full px-2 py-1 text-xs border border-gray-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Importo (€):
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={installment.amount}
                      onChange={(e) => updateInstallment(index, 'amount', parseFloat(e.target.value) || 0)}
                      className="w-full px-2 py-1 text-xs border border-gray-300 rounded-md"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeInstallment(index)}
                  className="text-red-600 hover:text-red-800 text-xs px-2 py-1"
                  title="Rimuovi rata"
                >
                  ❌
                </button>
              </div>
            ))}
            
            <div className="flex justify-between items-center mt-3">
              <span className="text-sm text-gray-600">
                Totale rate: €{installments.reduce((sum, inst) => sum + inst.amount, 0).toFixed(2)}
              </span>
              <button
                type="button"
                onClick={addInstallment}
                className="px-3 py-1 bg-green-600 text-white text-xs rounded-md hover:bg-green-700"
              >
                + Aggiungi Rata
              </button>
            </div>
            
            {Math.abs(installments.reduce((sum, inst) => sum + inst.amount, 0) - calculatedTotal) > 0.01 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-2">
                <p className="text-xs text-yellow-800">
                  ⚠️ Attenzione: La somma delle rate (€{installments.reduce((sum, inst) => sum + inst.amount, 0).toFixed(2)}) 
                  non corrisponde all'importo totale (€{calculatedTotal.toFixed(2)})
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end space-x-3 pt-4">
          <button type="button" onClick={onCancel} className="cs-btn cs-btn--ghost">Annulla</button>
          <button type="submit" className="cs-btn cs-btn--primary">{fee ? 'Aggiorna' : 'Crea'} Quota</button>
        </div>
      </form>
    </div>
  )
}
