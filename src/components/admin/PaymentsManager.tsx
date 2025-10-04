'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { exportToExcel } from '@/lib/utils/excelExport'
import PaymentModal from '@/components/admin/PaymentModal'

interface Payment {
  id?: string
  type: 'general_cost' | 'coach_payment'
  description: string
  amount: number
  frequency: 'one_time' | 'recurring'
  recurrence_pattern?: string
  status: 'to_pay' | 'paid'
  due_date?: string
  paid_at?: string
  
  // Foreign keys
  gym_id?: string
  activity_id?: string
  team_id?: string
  coach_id?: string
  
  created_at?: string
  updated_at?: string
  created_by?: string
  
  // Joined data
  gyms?: {
    id: string
    name: string
    address: string
  }
  activities?: {
    id: string
    name: string
  }
  teams?: {
    id: string
    name: string
    code: string
  }
  coaches?: {
    id: string
    first_name: string
    last_name: string
  }
  created_by_profile?: {
    first_name: string
    last_name: string
  }
}

interface Gym {
  id: string
  name: string
  address: string
}

interface Activity {
  id: string
  name: string
}

interface Team {
  id: string
  name: string
  code: string
}

interface Coach {
  id: string
  first_name: string
  last_name: string
}

export default function PaymentsManager() {
  const [payments, setPayments] = useState<Payment[]>([])
  const [gyms, setGyms] = useState<Gym[]>([])
  const [activities, setActivities] = useState<Activity[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [coaches, setCoaches] = useState<Coach[]>([])
  const [loading, setLoading] = useState(true)
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [filterType, setFilterType] = useState<'all' | 'general_cost' | 'coach_payment'>('all')
  const [filterStatus, setFilterStatus] = useState<'all' | 'to_pay' | 'paid'>('all')
  const supabase = createClient()

  useEffect(() => {
    loadPayments()
    loadGyms()
    loadActivities()
    loadTeams()
    loadCoaches()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const loadPayments = async () => {
    try {
      const response = await fetch('/api/admin/payments')
      if (!response.ok) {
        throw new Error('Failed to load payments')
      }
      const data = await response.json()
      setPayments(data)
    } catch (error) {
      console.error('Error loading payments:', error)
      setPayments([])
    }
    setLoading(false)
  }

  const loadGyms = async () => {
    const { data } = await supabase
      .from('gyms')
      .select('id, name, address')
      .order('name')

    setGyms(data || [])
  }

  const loadActivities = async () => {
    const { data } = await supabase
      .from('activities')
      .select('id, name')
      .order('name')

    setActivities(data || [])
  }

  const loadTeams = async () => {
    const { data } = await supabase
      .from('teams')
      .select('id, name, code')
      .order('name')

    setTeams(data || [])
  }

  const loadCoaches = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, first_name, last_name')
      .eq('role', 'coach')
      .order('first_name')

    setCoaches(data || [])
  }

  const generateRecurringPaymentDates = (pattern: string, startDate: string): string[] => {
    const dates: string[] = []
    const start = new Date(startDate)
    
    // Parse the pattern to determine frequency and duration
    const patternLower = pattern.toLowerCase()
    
    if (patternLower.includes('mensile') || patternLower.includes('monthly')) {
      // Monthly payments for 12 months
      for (let i = 0; i < 12; i++) {
        const date = new Date(start)
        date.setMonth(start.getMonth() + i)
        dates.push(date.toISOString().split('T')[0])
      }
    } else if (patternLower.includes('trimestrale') || patternLower.includes('quarterly')) {
      // Quarterly payments for 1 year (4 payments)
      for (let i = 0; i < 4; i++) {
        const date = new Date(start)
        date.setMonth(start.getMonth() + (i * 3))
        dates.push(date.toISOString().split('T')[0])
      }
    } else if (patternLower.includes('annuale') || patternLower.includes('yearly')) {
      // Yearly payments for 3 years
      for (let i = 0; i < 3; i++) {
        const date = new Date(start)
        date.setFullYear(start.getFullYear() + i)
        dates.push(date.toISOString().split('T')[0])
      }
    } else if (patternLower.includes('settimanale') || patternLower.includes('weekly')) {
      // Weekly payments for 12 weeks
      for (let i = 0; i < 12; i++) {
        const date = new Date(start)
        date.setDate(start.getDate() + (i * 7))
        dates.push(date.toISOString().split('T')[0])
      }
    } else {
      // Default: monthly for 12 months
      for (let i = 0; i < 12; i++) {
        const date = new Date(start)
        date.setMonth(start.getMonth() + i)
        dates.push(date.toISOString().split('T')[0])
      }
    }
    
    return dates
  }

  const handleCreatePayment = async (paymentData: Omit<Payment, 'id'>) => {
    try {
      if (paymentData.frequency === 'recurring' && paymentData.recurrence_pattern && paymentData.due_date) {
        // Handle recurring payments - create multiple payment records
        const paymentDates = generateRecurringPaymentDates(
          paymentData.recurrence_pattern,
          paymentData.due_date
        )
        
        // Create each payment individually via API
        for (const date of paymentDates) {
          const paymentToCreate = {
            ...paymentData,
            due_date: date,
            status: 'to_pay' as const
          }
          
          const response = await fetch('/api/admin/payments', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(paymentToCreate),
          })
          
          if (!response.ok) {
            throw new Error('Failed to create recurring payment')
          }
        }
        
        setShowModal(false)
        setEditingPayment(null)
        loadPayments()
      } else {
        // Handle one-time payments
        const response = await fetch('/api/admin/payments', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(paymentData),
        })

        if (response.ok) {
          setShowModal(false)
          setEditingPayment(null)
          loadPayments()
        } else {
          throw new Error('Failed to create payment')
        }
      }
    } catch (error) {
      console.error('Error creating payment:', error)
    }
  }

  const handleUpdatePayment = async (id: string, paymentData: Partial<Payment>) => {
    try {
      const response = await fetch('/api/admin/payments', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id, ...paymentData }),
      })

      if (response.ok) {
        setShowModal(false)
        setEditingPayment(null)
        loadPayments()
      } else {
        throw new Error('Failed to update payment')
      }
    } catch (error) {
      console.error('Error updating payment:', error)
    }
  }

  const handleDeletePayment = async (id: string) => {
    if (window.confirm('Sei sicuro di voler eliminare questo pagamento?')) {
      try {
        const response = await fetch(`/api/admin/payments?id=${id}`, {
          method: 'DELETE',
        })

        if (response.ok) {
          loadPayments()
        } else {
          throw new Error('Failed to delete payment')
        }
      } catch (error) {
        console.error('Error deleting payment:', error)
      }
    }
  }

  const markAsPaid = async (id: string) => {
    try {
      const response = await fetch('/api/admin/payments', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          id, 
          status: 'paid'
        }),
      })

      if (response.ok) {
        loadPayments()
      } else {
        throw new Error('Failed to mark payment as paid')
      }
    } catch (error) {
      console.error('Error marking payment as paid:', error)
    }
  }

  const markAsToPay = async (id: string) => {
    try {
      const response = await fetch('/api/admin/payments', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          id, 
          status: 'to_pay'
        }),
      })

      if (response.ok) {
        loadPayments()
      } else {
        throw new Error('Failed to mark payment as to pay')
      }
    } catch (error) {
      console.error('Error marking payment as to pay:', error)
    }
  }

  const exportPaymentsToExcel = () => {
    const filteredPayments = filterPayments()
    
    exportToExcel(filteredPayments, [
      { key: 'type', title: 'Tipo', width: 12, format: (val) => val === 'general_cost' ? 'Costo Generale' : 'Pagamento Allenatore' },
      { key: 'description', title: 'Descrizione', width: 25 },
      { key: 'amount', title: 'Importo', width: 10, format: (val) => `€${val.toFixed(2)}` },
      { key: 'frequency', title: 'Frequenza', width: 10, format: (val) => val === 'one_time' ? 'Una tantum' : 'Ricorrente' },
      { key: 'status', title: 'Stato', width: 10, format: (val) => val === 'paid' ? 'Pagato' : 'Da pagare' },
      { key: 'due_date', title: 'Scadenza', width: 12, format: (val) => val ? new Date(val).toLocaleDateString('it-IT') : 'N/D' },
      { key: 'paid_at', title: 'Data Pagamento', width: 12, format: (val) => val ? new Date(val).toLocaleDateString('it-IT') : '' },
      { key: 'gyms', title: 'Palestra', width: 15, format: (val) => val?.name || '' },
      { key: 'activities', title: 'Attività', width: 15, format: (val) => val?.name || '' },
      { key: 'teams', title: 'Squadra', width: 15, format: (val) => val?.name || '' },
      { key: 'coaches', title: 'Allenatore', width: 15, format: (val) => val ? `${val.first_name} ${val.last_name}` : '' },
      { key: 'created_by_profile', title: 'Creato Da', width: 15, format: (val) => val ? `${val.first_name} ${val.last_name}` : '' }
    ], {
      filename: 'pagamenti_csroma',
      sheetName: 'Pagamenti',
      headerStyle: { fill: { fgColor: { rgb: 'E67E22' } } }
    })
  }

  const filterPayments = () => {
    return payments.filter(payment => {
      const typeMatch = filterType === 'all' || payment.type === filterType
      const statusMatch = filterStatus === 'all' || payment.status === filterStatus
      return typeMatch && statusMatch
    })
  }

  const getStatusColor = (status: string) => {
    return status === 'paid' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
  }

  const getTypeColor = (type: string) => {
    return type === 'general_cost' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
  }

  const getTotalAmount = () => {
    const filtered = filterPayments()
    return filtered.reduce((total, payment) => total + payment.amount, 0)
  }

  const getPendingAmount = () => {
    const filtered = filterPayments().filter(p => p.status === 'to_pay')
    return filtered.reduce((total, payment) => total + payment.amount, 0)
  }

  if (loading) {
    return <div className="p-4">Caricamento pagamenti...</div>
  }

  const filteredPayments = filterPayments()

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Pagamenti</h2>
        <div className="flex gap-3">
          <button
            onClick={exportPaymentsToExcel}
            className="cs-btn cs-btn--accent"
          >
            <span className="mr-2">📊</span>
            Export Excel
          </button>
          <button
            onClick={() => {
              setEditingPayment(null)
              setShowModal(true)
            }}
            className="cs-btn cs-btn--primary"
          >
            Nuovo Pagamento
          </button>
        </div>
      </div>

      {/* Statistics */}
<div className="cs-grid" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 16 }}>
  <div className="cs-card p-6">
    <div className="text-sm text-secondary">Totale Pagamenti</div>
    <div className="text-2xl font-bold">€{getTotalAmount().toFixed(2)}</div>
    <div className="text-xs text-secondary">{filteredPayments.length} pagamenti</div>
  </div>

  <div className="cs-card p-6">
    <div className="text-sm text-secondary">Da Pagare</div>
    <div className="text-2xl font-bold">€{getPendingAmount().toFixed(2)}</div>
    <div className="text-xs text-secondary">
      {filteredPayments.filter(p => p.status === 'to_pay').length} in sospeso
    </div>
  </div>

  <div className="cs-card p-6">
    <div className="text-sm text-secondary">Pagati</div>
    <div className="text-2xl font-bold">
      €{(getTotalAmount() - getPendingAmount()).toFixed(2)}
    </div>
    <div className="text-xs text-secondary">
      {filteredPayments.filter(p => p.status === 'paid').length} completati
    </div>
  </div>
</div>

      {/* Filters */}
      <div className="cs-card p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="cs-field__label">Tipo Pagamento</label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as 'all' | 'general_cost' | 'coach_payment')}
              className="cs-select"
            >
              <option value="all">Tutti i tipi</option>
              <option value="general_cost">Costi Generali</option>
              <option value="coach_payment">Pagamenti Allenatori</option>
            </select>
          </div>
          <div>
            <label className="cs-field__label">Stato</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as 'all' | 'to_pay' | 'paid')}
              className="cs-select"
            >
              <option value="all">Tutti gli stati</option>
              <option value="to_pay">Da pagare</option>
              <option value="paid">Pagati</option>
            </select>
          </div>
        </div>
      </div>

        <PaymentModal
            open={showModal}
            onClose={() => { setShowModal(false); setEditingPayment(null) }}
            payment={editingPayment}
            gyms={gyms}
            activities={activities}
            teams={teams}
            coaches={coaches}
            onCreate={handleCreatePayment}
            onUpdate={handleUpdatePayment}
        />


<section className="cs-card">
  <div className="p-6 border-b">
    <div className="flex items-center justify-between">
      <h2 className="text-lg font-semibold">Elenco Pagamenti</h2>
      {/* opzionale: qui puoi aggiungere filtri/azioni come nella pagina atleti */}
    </div>
  </div>

  <div className="overflow-x-auto">
    <table className="cs-table">
      <thead>
        <tr>
          <th className="p-4 text-left text-sm font-medium">Descrizione</th>
          <th className="p-4 text-left text-sm font-medium">Tipo</th>
          <th className="p-4 text-left text-sm font-medium">Importo</th>
          <th className="p-4 text-left text-sm font-medium">Stato</th>
          <th className="p-4 text-left text-sm font-medium">Scadenza</th>
          <th className="p-4 text-left text-sm font-medium">Riferimento</th>
          <th className="p-4 text-left text-sm font-medium">Azioni</th>
        </tr>
      </thead>
      <tbody>
        {filteredPayments.map((payment) => (
          <tr key={payment.id}>
            <td className="p-4 align-top">
              <div className="font-medium">{payment.description}</div>
              <div className="text-xs text-secondary">
                {payment.frequency === 'recurring' ? 'Ricorrente' : 'Una tantum'}
              </div>
            </td>

            <td className="p-4 whitespace-nowrap align-top">
              <span className={`cs-badge cs-badge--neutral`}>
                {payment.type === 'general_cost' ? 'Costo Generale' : 'Allenatore'}
              </span>
            </td>

            <td className="p-4 whitespace-nowrap align-top">
              <div className="text-sm font-semibold">
                €{payment.amount.toFixed(2)}
              </div>
            </td>

            <td className="p-4 whitespace-nowrap align-top">
              <span className={`cs-badge ${
                payment.status === 'paid' ? 'cs-badge--success' : 'cs-badge--warning'
              }`}>
                {payment.status === 'paid' ? 'Pagato' : 'Da pagare'}
              </span>
            </td>

            <td className="p-4 whitespace-nowrap align-top">
              <div className="text-sm">
                {payment.due_date ? new Date(payment.due_date).toLocaleDateString('it-IT') : 'N/D'}
              </div>
            </td>

            <td className="p-4 align-top">
              <div className="text-sm">
                {payment.gyms && <>Palestra: {payment.gyms.name}<br/></>}
                {payment.activities && <>Attività: {payment.activities.name}<br/></>}
                {payment.teams && <>Squadra: {payment.teams.name}<br/></>}
                {payment.coaches && <>Allenatore: {payment.coaches.first_name} {payment.coaches.last_name}</>}
                {!payment.gyms && !payment.activities && !payment.teams && !payment.coaches && 'Generale'}
              </div>
            </td>

            <td className="p-4 whitespace-nowrap text-sm font-medium align-top">
              {payment.status === 'to_pay' ? (
                <button
                  onClick={() => markAsPaid(payment.id!)}
                  className="cs-btn cs-btn--ghost cs-btn--sm mr-2"
                  title="Segna come pagato"
                >
                  ✅
                </button>
              ) : (
                <button
                  onClick={() => markAsToPay(payment.id!)}
                  className="cs-btn cs-btn--ghost cs-btn--sm mr-2"
                  title="Segna come da pagare"
                >
                  ↩️
                </button>
              )}
              <button
                onClick={() => { setEditingPayment(payment); setShowModal(true) }}
                className="cs-btn cs-btn--outline cs-btn--sm"
              >
                Modifica
              </button>
              <button
                onClick={() => handleDeletePayment(payment.id!)}
                className="cs-btn cs-btn--primary"
              >
                Elimina
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
</section>

        {filteredPayments.length === 0 && (
          <div className="px-6 py-8 text-center">
            <div className="text-gray-500 mb-4">
              <span className="text-4xl">💳</span>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Nessun pagamento trovato
            </h3>
            <p className="text-gray-600 mb-4">
              {payments.length === 0 
                ? 'Crea il tuo primo pagamento per gestire i costi della società.'
                : 'Prova a modificare i filtri per vedere più risultati.'
              }
            </p>
            {payments.length === 0 && (
              <button
                onClick={() => {
                  setEditingPayment(null)
                  setShowModal(true)
                }}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
              >
                Crea il tuo primo pagamento
              </button>
            )}
          </div>
        )}
      </div>
  )
}

function PaymentForm({
  payment,
  gyms,
  activities,
  teams,
  coaches,
  onSubmit,
  onCancel
}: {
  payment: Payment | null
  gyms: Gym[]
  activities: Activity[]
  teams: Team[]
  coaches: Coach[]
  onSubmit: (data: Omit<Payment, 'id'>) => void
  onCancel: () => void
}) {
  const [formData, setFormData] = useState({
    type: payment?.type || 'general_cost',
    description: payment?.description || '',
    amount: payment?.amount || 0,
    frequency: payment?.frequency || 'one_time',
    recurrence_pattern: payment?.recurrence_pattern || '',
    status: payment?.status || 'to_pay',
    due_date: payment?.due_date || '',

    // Foreign keys
    gym_id: payment?.gym_id || '',
    activity_id: payment?.activity_id || '',
    team_id: payment?.team_id || '',
    coach_id: payment?.coach_id || ''
  })

  const [coachTeams, setCoachTeams] = useState<Team[]>([])
  const supabase = createClient()

  // Load coach's teams when coach is selected
  const loadCoachTeams = async (coachId: string) => {
    if (!coachId) {
      setCoachTeams([])
      return
    }

    try {
      const { data, error } = await supabase
        .from('team_coaches')
        .select(`
          teams (
            id,
            name,
            code
          )
        `)
        .eq('coach_id', coachId)

      if (error) {
        console.error('Error loading coach teams:', error)
        setCoachTeams([])
        return
      }

      const teams = data?.map(item => item.teams).filter(Boolean) as Team[] || []
      setCoachTeams(teams)
    } catch (error) {
      console.error('Error loading coach teams:', error)
      setCoachTeams([])
    }
  }

  // Effect to load coach teams when coach_id changes
  useEffect(() => {
    if (formData.type === 'coach_payment' && formData.coach_id) {
      loadCoachTeams(formData.coach_id)
    } else {
      setCoachTeams([])
    }
  }, [formData.coach_id, formData.type])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    // Clean up empty foreign keys
    const submitData = { ...formData }
    if (!submitData.gym_id) delete submitData.gym_id
    if (!submitData.activity_id) delete submitData.activity_id
    if (!submitData.team_id) delete submitData.team_id
    if (!submitData.coach_id) delete submitData.coach_id
    if (!submitData.recurrence_pattern) delete submitData.recurrence_pattern
    if (!submitData.due_date) delete submitData.due_date
    
    onSubmit(submitData)
  }

  const handleNumberChange = (field: string, value: string) => {
    const numValue = parseFloat(value) || 0
    setFormData(prev => ({ ...prev, [field]: numValue }))
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold mb-4">
        {payment ? 'Modifica Pagamento' : 'Nuovo Pagamento'}
      </h3>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Tipo Pagamento *
          </label>
          <select
            value={formData.type}
            onChange={(e) => setFormData({ ...formData, type: e.target.value as 'general_cost' | 'coach_payment' })}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="general_cost">Costo Generale</option>
            <option value="coach_payment">Pagamento Allenatore</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Descrizione *
          </label>
          <input
            type="text"
            required
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Descrizione del pagamento"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Importo (€) *
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              required
              value={formData.amount}
              onChange={(e) => handleNumberChange('amount', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Frequenza *
            </label>
            <select
              value={formData.frequency}
              onChange={(e) => setFormData({ ...formData, frequency: e.target.value as 'one_time' | 'recurring' })}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="one_time">Una tantum</option>
              <option value="recurring">Ricorrente</option>
            </select>
          </div>
        </div>

        {formData.frequency === 'recurring' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Pattern Ricorrenza
            </label>
            <input
              type="text"
              value={formData.recurrence_pattern}
              onChange={(e) => setFormData({ ...formData, recurrence_pattern: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Es: Mensile, Trimestrale, etc."
            />
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Stato
            </label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as 'to_pay' | 'paid' })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="to_pay">Da pagare</option>
              <option value="paid">Pagato</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Data Scadenza
            </label>
            <input
              type="date"
              value={formData.due_date}
              onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Reference selection based on payment type */}
        {formData.type === 'general_cost' ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Palestra (opzionale)
              </label>
              <select
                value={formData.gym_id}
                onChange={(e) => setFormData({ ...formData, gym_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Nessuna palestra</option>
                {gyms.map((gym) => (
                  <option key={gym.id} value={gym.id}>
                    {gym.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Attività (opzionale)
              </label>
              <select
                value={formData.activity_id}
                onChange={(e) => setFormData({ ...formData, activity_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Nessuna attività</option>
                {activities.map((activity) => (
                  <option key={activity.id} value={activity.id}>
                    {activity.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Squadra (opzionale)
              </label>
              <select
                value={formData.team_id}
                onChange={(e) => setFormData({ ...formData, team_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Nessuna squadra</option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Allenatore *
              </label>
              <select
                value={formData.coach_id}
                onChange={(e) => setFormData({ ...formData, coach_id: e.target.value, team_id: '' })}
                required={formData.type === 'coach_payment'}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Seleziona un allenatore</option>
                {coaches.map((coach) => (
                  <option key={coach.id} value={coach.id}>
                    {coach.first_name} {coach.last_name}
                  </option>
                ))}
              </select>
            </div>

            {formData.coach_id && coachTeams.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Squadra (opzionale)
                </label>
                <select
                  value={formData.team_id}
                  onChange={(e) => setFormData({ ...formData, team_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Nessuna squadra specifica</option>
                  {coachTeams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Seleziona una squadra per allocare il pagamento specificamente a quella squadra
                </p>
              </div>
            )}

            {formData.coach_id && coachTeams.length === 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                <p className="text-sm text-yellow-800">
                  Questo allenatore non è assegnato a nessuna squadra. Il pagamento sarà registrato come generale per l'allenatore.
                </p>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end space-x-3 pt-4">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
          >
            Annulla
          </button>
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            {payment ? 'Aggiorna' : 'Crea'} Pagamento
          </button>
        </div>
      </form>
    </div>
  )
}