import React, { useState } from 'react'
import { ShieldCheck, WarningCircle, ArrowRight } from '@phosphor-icons/react'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'
const TOKEN_KEY = 'craftureAdminToken'

export default function AdminLogin({ onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok || !data.token) {
        setError(data.message || 'Login failed.')
        return
      }
      localStorage.setItem(TOKEN_KEY, data.token)
      onLogin()
    } catch (_e) {
      setError('Could not reach the server.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6 font-sans">
      <form onSubmit={submit} className="w-full max-w-sm bg-white border border-slate-200 rounded-2xl shadow-sm p-8 space-y-5">
        <div className="text-center space-y-2">
          <span className="inline-flex w-12 h-12 rounded-2xl bg-slate-900 text-white items-center justify-center">
            <ShieldCheck size={24} weight="fill" />
          </span>
          <h1 className="text-lg font-extrabold text-slate-900">Crafture Admin Console</h1>
          <p className="text-xs text-slate-500">Restricted access — authorized operators only.</p>
        </div>

        {error && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-3.5 py-2.5 text-xs">
            <WarningCircle size={16} weight="fill" className="shrink-0 mt-0.5" />
            {error}
          </div>
        )}

        <div className="space-y-1.5">
          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Admin Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@crafture.com"
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-indigo-500"
            required
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••••••"
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-indigo-500"
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-700 disabled:opacity-50 text-white font-bold text-sm py-3 rounded-xl cursor-pointer"
        >
          {loading ? 'Verifying…' : <>Sign In <ArrowRight size={16} weight="bold" /></>}
        </button>

        <a href="/" className="block text-center text-[11px] text-slate-400 hover:text-slate-600">← Back to app</a>
      </form>
    </div>
  )
}

export { TOKEN_KEY }
