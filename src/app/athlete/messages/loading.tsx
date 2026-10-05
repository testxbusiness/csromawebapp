import PageHeader from '@/components/shared/PageHeader'
import { LoadingState } from '@/components/ui'

export default function Loading() {
  return (
    <>
      <PageHeader title="Messaggi" subtitle="Area Atleta" />
      <LoadingState label="Caricamento messaggi..." />
    </>
  )
}
