'use client'

export default function TemplateVariablesHelp() {
  return (
    <div className="cs-card">
      <div className="font-semibold mb-2">Placeholder disponibili</div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
        <div>
          <div className="text-secondary mb-1">Generali</div>
          <ul className="list-disc ml-5 space-y-1">
            <li><code>&#123;&#123;today&#125;&#125;</code> — Data odierna (es. 07/10/2025)</li>
          </ul>
        </div>
        <div>
          <div className="text-secondary mb-1">Target: <b>Team</b></div>
          <ul className="list-disc ml-5 space-y-1">
            <li><code>&#123;&#123;team_name&#125;&#125;</code> — Nome squadra</li>
            <li><code>&#123;&#123;athletes_list&#125;&#125;</code> — Elenco puntato atleti selezionati</li>
            <li><code>&#123;&#123;athletes_table&#125;&#125;</code> — Tabella atleti (nome/cognome, numero)</li>
            <li><code>&#123;&#123;athletes_count&#125;&#125;</code> — N. atleti selezionati</li>
          </ul>
        </div>
        <div>
          <div className="text-secondary mb-1">Target: <b>User</b></div>
          <ul className="list-disc ml-5 space-y-1">
            <li><code>&#123;&#123;first_name&#125;&#125;</code></li>
            <li><code>&#123;&#123;last_name&#125;&#125;</code></li>
            <li><code>&#123;&#123;email&#125;&#125;</code></li>
          </ul>
        </div>
        <div>
          <div className="text-secondary mb-1">Logo</div>
          <ul className="list-disc ml-5 space-y-1">
            <li>Se “Includi logo” è attivo nel template, in testa al documento verrà inserito il logo <code>/logo.png</code> (personalizzabile).</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
