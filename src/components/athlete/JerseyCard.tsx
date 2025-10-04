'use client'
import * as React from 'react'
import clsx from 'clsx'
import { Teko } from 'next/font/google'   // puoi usare Anton, Bebas Neue, Jersey_10, etc.

const jerseyFont = Teko({ subsets: ['latin'], weight: ['700'] })

type JerseyCardProps = {
  number: string | number
  color?: string
  outline?: string
  outlineWidth?: number
  maxWidth?: number
  /** opzionale: override del font da fuori */
  fontClassName?: string
}

export function JerseyCard({
  number,
  color = 'var(--cs-warm)',
  outline = 'var(--cs-accent)',
  outlineWidth = 3,
  maxWidth = 320,
  fontClassName,
}: JerseyCardProps) {
  return (
    <div className="relative mx-auto" style={{ width: `clamp(180px, 48vw, ${maxWidth}px)` }}>
      <img src="/images/maglia_back.png" alt="Maglia CS Roma" className="block w-full h-auto" />

      <span
        className={clsx('jersey-number', fontClassName ?? jerseyFont.className)}
        style={{
          left: 0, right: 0, bottom: '34%', position: 'absolute', textAlign: 'center',
          fontSize: 'clamp(28px, 10vw, 72px)', lineHeight: 1,
          color, WebkitTextStroke: `${outlineWidth}px ${outline}`,
          textShadow: `0 1px 0 ${outline}, 0 2px 0 ${outline}`, letterSpacing: '2px',
        }}
      >
        {number}
      </span>
    </div>
  )
}
