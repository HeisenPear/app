'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Package, Lock, Loader2, AlertCircle } from 'lucide-react'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const from = searchParams.get('from') || '/'

  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Connexion impossible')
      }
      router.push(from)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div
            className="w-14 h-14 rounded-xl flex items-center justify-center mb-3"
            style={{ backgroundColor: '#15431F' }}
          >
            <Package className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">Analyseur Frais de Port</h1>
          <p className="text-sm text-gray-500 mt-1">Accès réservé — veuillez vous identifier</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Mot de passe</label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              placeholder="••••••••"
              className="w-full text-sm text-gray-900 placeholder:text-gray-400 bg-white border border-gray-300 rounded-lg pl-9 pr-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-green-700 focus:border-transparent"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 mt-3 text-sm text-red-600">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !password}
            className="w-full mt-5 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            style={{ backgroundColor: '#15431F' }}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
            Se connecter
          </button>
        </form>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  )
}
