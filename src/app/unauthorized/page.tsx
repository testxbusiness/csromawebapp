'use client'

import Link from 'next/link'

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="cs-card p-8 text-center">
          <div className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-white text-2xl font-bold">!</span>
          </div>
          
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Accesso Non Autorizzato</h1>
          
          <p className="text-gray-600 mb-6">
            Non hai i permessi necessari per accedere a questa pagina.
          </p>
          
          <div className="space-y-3">
            <Link
              href="/dashboard"
              className="block w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
            >
              Torna alla Dashboard
            </Link>
            
            <button
              onClick={() => window.history.back()}
              className="block w-full bg-gray-200 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-300 transition-colors"
            >
              Torna Indietro
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
