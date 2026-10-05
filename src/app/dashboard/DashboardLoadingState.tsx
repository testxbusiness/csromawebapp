export default function DashboardLoadingState() {
  return (
    <section className="space-y-8" aria-busy="true" aria-label="Caricamento dashboard">
      <div className="space-y-2">
        <p className="cs-eyebrow">CSRoma</p>
        <h1 className="text-2xl font-semibold tracking-tight">Panoramica account</h1>
        <p className="text-sm text-muted-foreground">Stiamo caricando i dati più importanti del tuo profilo.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="cs-card cs-card--lg min-h-40">
          <div className="cs-skeleton h-5 w-40" />
          <div className="mt-5 space-y-3">
            <div className="cs-skeleton h-4 w-full" />
            <div className="cs-skeleton h-4 w-4/5" />
          </div>
        </div>
        <div className="cs-card cs-card--lg min-h-40">
          <div className="cs-skeleton h-5 w-32" />
          <div className="mt-5 space-y-3">
            <div className="cs-skeleton h-4 w-full" />
            <div className="cs-skeleton h-4 w-3/5" />
          </div>
        </div>
      </div>
    </section>
  )
}
