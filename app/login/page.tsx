'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Image from 'next/image'

function toEmail(username: string) {
  return `${username.toLowerCase().trim()}@pratiti.local`
}

export default function LoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email: toEmail(username), password })
    if (error) { setError('Invalid username or password'); setLoading(false) }
    else { router.push('/'); router.refresh() }
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
              </div>
            </div>

            {error && (
              <p className="text-[13px] text-[#FF3B30] bg-[#FF3B30]/10 rounded-xl px-3 py-2">{error}</p>
            )}

            <button type="submit" disabled={loading}
              className="w-full py-3 bg-[#007AFF] text-white rounded-xl text-[15px] font-semibold active:opacity-80 disabled:opacity-50 transition-opacity">
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
