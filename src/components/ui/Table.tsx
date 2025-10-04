'use client'

import { HTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'

interface TableProps extends HTMLAttributes<HTMLTableElement> {
  compact?: boolean
}

const Table = forwardRef<HTMLTableElement, TableProps>(
  ({ className, compact = false, ...props }, ref) => {
    return (
      <table
        ref={ref}
        className={cn(
          'cs-table',
          compact && 'cs-table--compact',
          className
        )}
        {...props}
      />
    )
  }
)

Table.displayName = 'Table'

const TableActions = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('cs-table__actions', className)}
      {...props}
    />
  )
)

TableActions.displayName = 'TableActions'

export { Table, TableActions }