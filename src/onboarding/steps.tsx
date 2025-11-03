'use client'

import type { Tour } from 'nextstepjs'

// Role-based product tours for Coach and Athlete
export const onboardingTours: Tour[] = [
  {
    tour: 'coach',
    steps: [
      {
        icon: <>👋</>,
        title: 'Benvenuto Coach',
        content: <>Qui trovi un riepilogo rapido delle tue attività.</>,
        selector: '#coach-welcome',
        side: 'top',
        showControls: true,
        showSkip: true,
      },
            {
        icon: <>👥</>,
        title: 'Le tue squadre',
        content: <>Visualizza le squadre a cui sei associato.</>,
        selector: '#coach-teams',
        side: 'top',
        showControls: true,
        showSkip: true,        
      },
      {
        icon: <>📅</>,
        title: 'Prossimi eventi',
        content: <>Le prossime gare/allenamenti assegnate alle tue squadre.</>,
        selector: '#coach-events',
        side: 'top',
        showControls: true,
        showSkip: true,
      },
      {
        icon: <>✉️</>,
        title: 'Messaggi',
        content: <>Qui vedi gli ultimi messaggi per le tue squadre.</>,
        selector: '#coach-messages',
        side: 'top',
        showControls: true,
        showSkip: true,
      },
      {
        icon: <>💳</>,
        title: 'Pagamenti',
        content: <>Riepilogo dei rimborsi/compensi a te associati.</>,
        selector: '#coach-payments',
        side: 'top',
        showControls: true,
        showSkip: true,
      },
    ],
  },
  {
    tour: 'athlete',
    steps: [
      {
        icon: <>👋</>,
        title: 'Benvenuto Atleta',
        content: <>Questa è la tua area personale con tutto il necessario.</>,
        selector: '#athlete-welcome',
        side: 'top',
        showControls: true,
        showSkip: true,
      },
      {
        icon: <>👥</>,
        title: 'Le tue squadre',
        content: <>Visualizza le squadre a cui sei iscritto e lo stato certificato.</>,
        selector: '#athlete-teams',
        side: 'top',
        showControls: true,
        showSkip: true,        
      },
      {
        icon: <>📅</>,
        title: 'Prossimi eventi',
        content: <>Allenamenti e partite in programma nelle prossime settimane.</>,
        selector: '#athlete-events',
        side: 'top',
        showControls: true,
        showSkip: true,
      },
      {
        icon: <>✉️</>,
        title: 'Messaggi',
        content: <>Qui trovi i messaggi ricevuti da società e coach.</>,
        selector: '#athlete-messages',
        side: 'top',
        showControls: true,
        showSkip: true,
      },
      {
        icon: <>💶</>,
        title: 'Quote associative',
        content: <>Controlla le rate e lo stato dei pagamenti.</>,
        selector: '#athlete-fees',
        side: 'top',
        showControls: true,
        showSkip: true,
      },
    ],
  },
]

