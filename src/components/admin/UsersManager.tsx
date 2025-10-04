'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { exportUsers } from '@/lib/utils/excelExport'
import ImportManager from './ImportManager'
import type { User, UserFormData } from './userTypes'
import UserFormModal from './UserFormModal'

interface AccountUser extends User {
  id: string
  roles: string[]
  is_active: boolean
  last_sign_in_at?: string
  must_change_password?: boolean
}

export default function UsersManager() {
  const [users, setUsers] = useState<AccountUser[]>([])
  const [loading, setLoading] = useState(true)
  const [editingUser, setEditingUser] = useState<AccountUser | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [formSubmitting, setFormSubmitting] = useState(false)
  const supabase = createClient()

  // Filtri
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'coach' | 'athlete'>('all')

  const loadUsers = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/users')
      const result = await response.json()

      if (!response.ok) {
        console.error('Errore caricamento utenti:', result.error)
        setUsers([])
        setLoading(false)
        return
      }

      setUsers(result.users || [])
    } catch (error) {
      console.error('Errore caricamento utenti:', error)
      setUsers([])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    loadUsers()
  }, [loadUsers])

  // Gestione account
  const handleToggleActive = async (userId: string) => {
    try {
      const response = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, action: 'toggle_active' })
      })

      const result = await response.json()

      if (!response.ok) {
        console.error('Errore toggle attivo:', result.error)
        alert(`Errore: ${result.error}`)
        return
      }

      alert(result.message)
      loadUsers()
    } catch (error) {
      console.error('Errore toggle attivo:', error)
      alert('Errore di rete')
    }
  }

  const handleUpdateRoles = async (userId: string, roles: string[]) => {
    try {
      const response = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, action: 'update_roles', roles })
      })

      const result = await response.json()

      if (!response.ok) {
        console.error('Errore aggiornamento ruoli:', result.error)
        alert(`Errore: ${result.error}`)
        return
      }

      alert(result.message)
      loadUsers()
    } catch (error) {
      console.error('Errore aggiornamento ruoli:', error)
      alert('Errore di rete')
    }
  }

  const handleCreateUser = async (userData: UserFormData) => {
    setFormSubmitting(true)
    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData)
      })

      const result = await response.json()

      if (!response.ok) {
        console.error('Errore creazione utente:', result.error)
        alert(`Errore: ${result.error}`)
        return
      }

      alert(result.message)
      setShowForm(false)
      setEditingUser(null)
      loadUsers()
    } catch (error) {
      console.error('Errore creazione utente:', error)
      alert('Errore di rete')
    } finally {
      setFormSubmitting(false)
    }
  }

  const handleUpdateUser = async (id: string, userData: Partial<UserFormData>) => {
    setFormSubmitting(true)
    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...userData,
          email: editingUser?.email
        })
      })

      const result = await response.json()

      if (!response.ok) {
        console.error('Errore aggiornamento utente:', result.error)
        alert(`Errore: ${result.error}`)
        return
      }

      alert(result.message)
      setShowForm(false)
      setEditingUser(null)
      loadUsers()
    } catch (error) {
      console.error('Errore aggiornamento utente:', error)
      alert('Errore di rete')
    } finally {
      setFormSubmitting(false)
    }
  }

  const handleDeleteUser = async (id: string) => {
    if (window.confirm('Sei sicuro di voler eliminare questo account? Questa azione è irreversibile.')) {
      try {
        const response = await fetch(`/api/admin/users?id=${id}`, {
          method: 'DELETE',
        })

        const result = await response.json()

        if (!response.ok) {
          console.error('Errore eliminazione utente:', result.error)
          alert(`Errore: ${result.error}`)
          return
        }

        alert('Account eliminato con successo')
        loadUsers()
      } catch (error) {
        console.error('Errore eliminazione utente:', error)
        alert('Errore di rete')
      }
    }
  }

  const handleResetPassword = async (id: string) => {
    if (!window.confirm('Resettare la password di questo utente alla password iniziale?')) return

    try {
      const response = await fetch('/api/admin/users/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: id })
      })

      const result = await response.json()

      if (!response.ok) {
        console.error('Errore reset password:', result.error)
        alert(`Errore: ${result.error}`)
        return
      }

      alert('Password resettata. L\'utente dovrà cambiare la password al prossimo accesso.')
    } catch (error) {
      console.error('Errore reset password:', error)
      alert('Errore di rete')
    }
  }

  // Statistiche
  const userStats = useMemo(() => {
    const total = users.length
    const active = users.filter(u => u.is_active).length
    const inactive = users.filter(u => !u.is_active).length
    const admins = users.filter(u => u.roles?.includes('admin')).length
    const coaches = users.filter(u => u.roles?.includes('coach')).length
    const athletes = users.filter(u => u.roles?.includes('athlete')).length

    return { total, active, inactive, admins, coaches, athletes }
  }, [users])

  // Filtra utenti
  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      // Filtro ricerca
      if (searchTerm) {
        const term = searchTerm.toLowerCase()
        const matchesName = `${user.first_name} ${user.last_name}`.toLowerCase().includes(term)
        const matchesEmail = user.email.toLowerCase().includes(term)
        if (!matchesName && !matchesEmail) return false
      }

      // Filtro stato
      if (statusFilter !== 'all') {
        const isActive = user.is_active
        if (statusFilter === 'active' && !isActive) return false
        if (statusFilter === 'inactive' && isActive) return false
      }

      // Filtro ruolo
      if (roleFilter !== 'all') {
        const hasRole = user.roles?.includes(roleFilter)
        if (!hasRole) return false
      }

      return true
    })
  }, [users, searchTerm, statusFilter, roleFilter])

  // Utility functions
  const getRoleBadge = (role: string) => {
    const variant = role === 'admin' ? 'danger' : role === 'coach' ? 'warning' : 'neutral'
    return <span className={`cs-badge cs-badge--${variant}`}>{role.toUpperCase()}</span>
  }

  const getStatusBadge = (isActive: boolean) => {
    return isActive ? (
      <span className="cs-badge cs-badge--success">ATTIVO</span>
    ) : (
      <span className="cs-badge cs-badge--neutral">DISATTIVATO</span>
    )
  }

  const formatLastLogin = (lastSignInAt?: string) => {
    if (!lastSignInAt) return 'Mai'
    return new Date(lastSignInAt).toLocaleDateString('it-IT')
  }

  if (loading) {
    return <div className="p-4">Caricamento account...</div>
  }

  const handleExportUsers = () => {
    const dataset = users.map(user => ({
      'Nome': user.first_name,
      'Cognome': user.last_name,
      'Email': user.email,
      'Ruoli': user.roles?.join(', ') || '',
      'Stato': user.is_active ? 'Attivo' : 'Disattivato',
      'Ultimo Accesso': formatLastLogin(user.last_sign_in_at),
      'Data Creazione': user.created_at ? new Date(user.created_at).toLocaleDateString('it-IT') : '',
      'Telefono': user.phone || '',
      'Data Nascita': user.birth_date || ''
    }))
    exportUsers(dataset, 'account-utenti')
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <section className="cs-card p-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-secondary">
              Identità, Account e Governance
            </p>
            <h2 className="text-3xl font-semibold">
              Gestione Centralizzata degli Account
            </h2>
            <p className="text-sm text-secondary">
              Gestisci identità, ruoli e stato degli account del sistema. Per operazioni specifiche su atleti e collaboratori, utilizza le sezioni dedicate.
            </p>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="cs-badge cs-badge--neutral">Totale: {userStats.total}</span>
              <span className="cs-badge cs-badge--success">Attivi: {userStats.active}</span>
              <span className="cs-badge cs-badge--neutral">Disattivati: {userStats.inactive}</span>
              <span className="cs-badge cs-badge--danger">Admin: {userStats.admins}</span>
              <span className="cs-badge cs-badge--warning">Coach: {userStats.coaches}</span>
              <span className="cs-badge cs-badge--neutral">Atleti: {userStats.athletes}</span>
            </div>
          </div>
          <div className="flex flex-col gap-3 text-sm sm:flex-row">
            <button className="cs-btn cs-btn--outline" onClick={() => setShowImport(true)}>Importa CSV</button>
            <button className="cs-btn cs-btn--outline" onClick={handleExportUsers}>Esporta Account</button>
            <button className="cs-btn cs-btn--primary" onClick={() => { setEditingUser(null); setShowForm(true) }}>Nuovo Account</button>
          </div>
        </div>
      </section>

      {/* Filtri */}
      <div className="cs-card p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h3 className="text-lg font-semibold">Gestione Account</h3>
            <p className="text-sm text-secondary">
              Gestisci identità, ruoli e stato degli account. Risultati mostrati: {filteredUsers.length}.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="min-w-[200px]">
              <label className="cs-field__label">Cerca</label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Nome, cognome, email..."
                className="cs-input"
              />
            </div>
            <FilterSelect
              id="status-filter"
              label="Stato"
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: 'all', label: 'Tutti' },
                { value: 'active', label: 'Attivi' },
                { value: 'inactive', label: 'Disattivati' }
              ]}
            />
            <FilterSelect
              id="role-filter"
              label="Ruolo"
              value={roleFilter}
              onChange={setRoleFilter}
              options={[
                { value: 'all', label: 'Tutti' },
                { value: 'admin', label: 'Amministratore' },
                { value: 'coach', label: 'Allenatore' },
                { value: 'athlete', label: 'Atleta' }
              ]}
            />
          </div>
        </div>
      </div>

      {/* Tabella Account */}
      <div className="space-y-4">
        <div className="hidden cs-card overflow-hidden md:block">
          <table className="cs-table">
            <thead>
              <tr>
                <th>Utente</th>
                <th>Stato</th>
                <th>Ruoli</th>
                <th>Ultimo Accesso</th>
                <th>Azioni</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr key={user.id}>
                  <td>
                    <div className="flex items-center gap-4">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[color:var(--cs-primary)]/10 text-base font-semibold text-[color:var(--cs-primary)]">
                        {getInitials(user)}
                      </div>
                      <div>
                        <p className="font-semibold">
                          {user.first_name} {user.last_name}
                        </p>
                        <p className="text-xs text-secondary">{user.email}</p>
                        <p className="text-xs text-secondary">
                          Creato il {user.created_at ? new Date(user.created_at).toLocaleDateString('it-IT') : 'N/A'}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td>
                    {getStatusBadge(user.is_active)}
                  </td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      {user.roles?.map(role => (
                        <span key={role} className="inline-block">
                          {getRoleBadge(role)}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="text-sm text-secondary">
                    {formatLastLogin(user.last_sign_in_at)}
                  </td>
                  <td className="text-sm font-medium">
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => handleToggleActive(user.id)}
                        className="cs-btn cs-btn--outline cs-btn--sm"
                      >
                        {user.is_active ? 'Disattiva' : 'Attiva'}
                      </button>
                      <button
                        onClick={() => handleResetPassword(user.id)}
                        className="cs-btn cs-btn--outline cs-btn--sm"
                      >
                        Reset PW
                      </button>
                      <button
                        onClick={() => {
                          setEditingUser(user)
                          setShowForm(true)
                        }}
                        className="cs-btn cs-btn--outline cs-btn--sm"
                      >
                        Modifica
                      </button>
                      <button
                        onClick={() => handleDeleteUser(user.id)}
                        className="cs-btn cs-btn--danger cs-btn--sm"
                      >
                        Elimina
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredUsers.length === 0 && (
            <EmptyState
              hasUsers={users.length > 0}
              onCreate={() => {
                setEditingUser(null)
                setShowForm(true)
              }}
            />
          )}
        </div>

        {/* Vista Mobile */}
        <div className="space-y-3 md:hidden">
          {filteredUsers.length > 0 ? (
            filteredUsers.map((user) => (
              <div
                key={user.id}
                className="cs-card p-5"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[color:var(--cs-primary)]/10 text-sm font-semibold text-[color:var(--cs-primary)]">
                    {getInitials(user)}
                  </div>
                  <div className="flex-1">
                    <p className="text-base font-semibold text-[color:var(--cs-text-primary)]">
                      {user.first_name} {user.last_name}
                    </p>
                    <p className="text-xs text-[color:var(--cs-text-secondary)]">{user.email}</p>
                  </div>
                  {getStatusBadge(user.is_active)}
                </div>
                <div className="mt-4 space-y-2 text-xs text-[color:var(--cs-text-secondary)]">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[color:var(--cs-text-primary)]">Ruoli:</span>
                    <div className="flex flex-wrap gap-1">
                      {user.roles?.map(role => (
                        <span key={role} className="inline-block">
                          {getRoleBadge(role)}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[color:var(--cs-text-primary)]">Ultimo accesso:</span>
                    <span>{formatLastLogin(user.last_sign_in_at)}</span>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
                  <button
                    onClick={() => handleToggleActive(user.id)}
                    className="cs-btn cs-btn--outline cs-btn--sm flex-1"
                  >
                    {user.is_active ? 'Disattiva' : 'Attiva'}
                  </button>
                  <button
                    onClick={() => handleResetPassword(user.id)}
                    className="cs-btn cs-btn--ghost cs-btn--sm flex-1"
                  >
                    Reset PW
                  </button>
                  <button
                    onClick={() => {
                      setEditingUser(user)
                      setShowForm(true)
                    }}
                    className="cs-btn cs-btn--primary cs-btn--sm flex-1"
                  >
                    Modifica
                  </button>
                  <button
                    onClick={() => handleDeleteUser(user.id)}
                    className="cs-btn cs-btn--danger cs-btn--sm flex-1"
                  >
                    Elimina
                  </button>
                </div>
              </div>
            ))
          ) : (
            <EmptyState
              hasUsers={users.length > 0}
              onCreate={() => {
                setEditingUser(null)
                setShowForm(true)
              }}
            />
          )}
        </div>
      </div>

      {/* Modals */}
      <UserFormModal
        isOpen={showForm}
        user={editingUser}
        teams={[]} // Empty teams array since UsersManager focuses on account governance
        isSubmitting={formSubmitting}
        onSubmit={(data) => {
          if (editingUser?.id) {
            handleUpdateUser(editingUser.id, data)
          } else {
            handleCreateUser(data)
          }
        }}
        onClose={() => {
          setShowForm(false)
          setEditingUser(null)
        }}
      />

      {showImport && (
        <ImportManager
          type="users"
          onComplete={() => {
            setShowImport(false)
            loadUsers()
          }}
        />
      )}
    </div>
  )
}

function FilterSelect({
  id,
  label,
  value,
  onChange,
  options,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <label className="cs-field__label">
      {label}
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="cs-select"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}

function EmptyState({ hasUsers, onCreate }: { hasUsers: boolean; onCreate: () => void }) {
  return (
    <div className="px-6 py-12 text-center text-sm text-secondary">
      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[color:var(--cs-outline)]/35 text-3xl">
        👥
      </div>
      <h3 className="mt-4 text-lg font-semibold">
        {hasUsers ? 'Nessun account corrisponde ai filtri' : 'Nessun account ancora registrato'}
      </h3>
      <p className="mt-1 text-sm text-secondary">
        {hasUsers
          ? 'Modifica o azzera i filtri per mostrare altri risultati.'
          : 'Crea il primo account per iniziare a popolare il sistema.'}
      </p>
      {!hasUsers && (
        <button
          onClick={onCreate}
          className="mt-6 cs-btn cs-btn--primary"
        >
          Crea il primo account
        </button>
      )}
    </div>
  )
}

function getInitials(user: User) {
  return [user.first_name, user.last_name]
    .filter(Boolean)
    .map((item) => item!.toString().trim()[0]?.toUpperCase() ?? '')
    .join('')
    .slice(0, 2)
}
