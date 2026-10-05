import PageHeader from '@/components/shared/PageHeader'
import { LoadingState } from '@/components/ui'

export default function Loading() {
  return (
    <>
      <PageHeader title="Amministrazione" subtitle="Area Atleta" />
      <LoadingState label="Caricamento amministrazione..." />
    </>
  )
}
