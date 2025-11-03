'use client'

import { NextStep, NextStepProvider } from 'nextstepjs'
import { onboardingTours } from '@/onboarding/steps'

export default function OnboardingProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextStepProvider>
      <NextStep steps={onboardingTours}>{children}</NextStep>
    </NextStepProvider>
  )
}

