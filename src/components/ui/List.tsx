import * as React from 'react'

export function List({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={`cs-list ${className ?? ''}`}>{children}</div>
}

type ListItemProps = {
  title: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
  className?: string
}
export function ListItem({ title, description, actions, className }: ListItemProps) {
  return (
    <div className={`cs-list-item ${className ?? ''}`}>
      <div>
        <div className="cs-list-item__title">{title}</div>
        {description && <div className="cs-list-item__description">{description}</div>}
      </div>
      {actions && <div style={{ display: 'flex', gap: 8 }}>{actions}</div>}
    </div>
  )
}
