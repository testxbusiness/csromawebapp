import type { AnchorHTMLAttributes, ButtonHTMLAttributes, HTMLAttributes, MouseEventHandler, ReactNode } from 'react'
import { cn } from '@/lib/utils'

type CommonProps = {
  leading?: ReactNode
  trailing?: ReactNode
  interactive?: boolean
  className?: string
  children?: ReactNode
}

type ListRowProps = CommonProps &
  (AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; onClick?: never } |
    ButtonHTMLAttributes<HTMLButtonElement> & { href?: never; onClick: MouseEventHandler<HTMLButtonElement> } |
    HTMLAttributes<HTMLDivElement> & { href?: never; onClick?: never })

export function ListRow({ leading, trailing, interactive, className, children, ...props }: ListRowProps) {
  const rowClassName = cn('cs-list-row', interactive && 'cs-list-row--interactive', className)
  const content = (
    <>
      {leading ? <span className="cs-list-row__leading" aria-hidden="true">{leading}</span> : null}
      <span className="cs-list-row__content">{children}</span>
      {trailing ? <span className="cs-list-row__trailing">{trailing}</span> : null}
    </>
  )

  if ('href' in props && props.href) {
    return <a {...(props as AnchorHTMLAttributes<HTMLAnchorElement>)} className={rowClassName}>{content}</a>
  }
  if ('onClick' in props && props.onClick) {
    const buttonProps = props as ButtonHTMLAttributes<HTMLButtonElement>
    return <button {...buttonProps} type={buttonProps.type ?? 'button'} className={rowClassName}>{content}</button>
  }
  return <div {...(props as HTMLAttributes<HTMLDivElement>)} className={rowClassName}>{content}</div>
}
