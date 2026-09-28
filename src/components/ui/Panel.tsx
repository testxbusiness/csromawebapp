import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export function Panel({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return <section className={cn('cs-panel', className)} {...props} />
}
