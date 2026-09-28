'use client'

import { SubjectSwitcher } from './SubjectSwitcher'

export default function AccessibleProfileSelector({ variant = 'desktop' }: { variant?: 'desktop' | 'mobile' }) {
  return <SubjectSwitcher variant={variant} />
}
