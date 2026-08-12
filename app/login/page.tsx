'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Image from 'next/image'

type Mode = 'login' | 'signup'

// Supabase Auth requires email format; we derive one from username internally
function toEmail(username: string) {
  return `${username.toLowerCase().trim()}@pratiti.local`
}

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function switchMode(m: Mode) { setMode(m); setError(null) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError(null)
    const email = toEmail(username)

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) { setError('Invalid username or password'); setLoading(false) }
      else { router.push('/'); router.refresh() }
    } else {
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) { setError(error.message); setLoading(false) }
      else if (data.session) {
        router.push('/'); router.refresh()
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
        if (signInError) { setError(signInError.message); setLoading(false) }
        else { router.push('/'); router.refresh() }
      }
    }
  }

  return (
    <div className="min-h-screen bg-[#F2F2F7] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8 gap-3">
          <Image src="/applogo.png" alt="Pratiti" width={56} height={56} className="rounded-2xl" />
          <div className="text-center">
            <h1 className="text-[22px] font-bold text-[#000000]">Pratiti</h1>
            <p className="text-[13px] text-[#8E8E93] mt-0.5">Patient Admission Management</p>
          </div>
        </div>

        <div className="flex bg-[#E5E5EA] rounded-xl p-1 mb-4">
          {(['login', 'signup'] as Mode[]).map(m => (
            <button key={m} type="button" onClick={() => switchMode(m)}
              className={`flex-1 py-1.5 rounded-[10px] text-[14px] font-medium transition-all ${
                mode === m ? 'bg-white text-[#000000] shadow-sm' : 'text-[#8E8E93]'
              }`}>
              {m === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-[rgba(60,60,67,0.1)] overflow-hidden">
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div className="space-y-3">
              <div>
                <label className="text-[12px] font-medium text-[#8E8E93] uppercase tracking-wide">Username</label>
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="e.g. arjun.sathe"
                  required
                  autoCapitalize="none"
                  autoCorrect="off"
                  className="mt-1 w-full px-3 py-2.5 rounded-xl border border-[rgba(60,60,67,0.2)] text-[15px] bg-[#F2F2F7] focus:outline-none focus:border-[#007AFF] focus:bg-white transition-colors"
                />
              </div>
              <div>
                <label className="text-[12px] font-medium text-[#8E8E93] uppercase tracking-wide">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={8}
                  className="mt-1 w-full px-3 py-2.5 rounded-xl border border-[rgba(60,60,67,0.2)] text-[15px] bg-[#F2F2F7] focus:outline-none focus:border-[#007AFF] focus:bg-white transition-colors"
                />
                {mode === 'signup' && (
                  <p className="text-[11px] text-[#8E8E93] mt-1">Minimum 8 characters</p>
                )}
              </div>
            </div>

            {error && (
              <p className="text-[13px] text-[#FF3B30] bg-[#FF3B30]/10 rounded-xl px-3 py-2">{error}</p>
            )}

            <button type="submit" disabled={loading}
              className="w-full py-3 bg-[#007AFF] text-white rounded-xl text-[15px] font-semibold active:opacity-80 disabled:opacity-50 transition-opacity">
              {loading
                ? (mode === 'login' ? 'Signing in…' : 'Creating account…')
                : (mode === 'login' ? 'Sign In' : 'Create Account')}
            </button>
          </form>
        </div>

        {mode === 'login' && (
          <p className="text-center text-[12px] text-[#8E8E93] mt-6">
            Don&apos;t have an account?{' '}
            <button onClick={() => switchMode('signup')} className="text-[#007AFF] font-medium">Create one</button>
          </p>
        )}
      </div>
    </div>
  )
}
