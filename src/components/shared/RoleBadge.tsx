'use client'

export default function RoleBadge({ role }: { role?: string }) {
  const r = (role || '').toLowerCase()
  const classes = r === 'admin'
    ? 'bg-blue-100 text-blue-800'
    : r === 'coach'
    ? 'bg-purple-100 text-purple-800'
    : 'bg-green-100 text-green-800' // athlete or default
  return (
    <span className={`ml-2 text-sm px-2 py-1 rounded ${classes}`}>{role?.toUpperCase()}</span>
  )
}

