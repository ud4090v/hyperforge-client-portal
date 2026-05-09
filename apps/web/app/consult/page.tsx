'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createBrowserClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

interface BookingFormData {
  name: string
  email: string
  projectDescription: string
}

export default function ConsultPage() {
  const router = useRouter()
  const [formData, setFormData] = useState<BookingFormData>({
    name: '',
    email: '',
    projectDescription: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const supabase = createBrowserClient()

      const { data: userData } = await supabase.auth.getUser()
      const user = userData?.user

      if (!user) {
        // Send magic link
        const { error: authError } = await supabase.auth.signInWithOtp({
          email: formData.email,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback?redirect=/consult`,
          },
        })
        if (authError) throw authError
        setSuccess(true)
        return
      }

      // Ensure customer row exists
      const { data: existingCustomer } = await supabase
        .from('customers')
        .select('id')
        .eq('auth_id', user.id)
        .single()

      let customerId: string

      if (existingCustomer?.id) {
        customerId = existingCustomer.id as string
      } else {
        const { data: newCustomer, error: insertError } = await supabase
          .from('customers')
          .insert({
            auth_id: user.id,
            email: formData.email || (user.email ?? ''),
            name: formData.name,
            tier: 'consult',
          })
          .select('id')
          .single()

        if (insertError ?? !newCustomer) {
          throw insertError ?? new Error('Failed to create customer')
        }
        customerId = (newCustomer as { id: string }).id
      }

      // Create consult session
      const { data: sessionData, error: sessionError } = await supabase
        .from('consult_sessions')
        .insert({
          customer_id: customerId,
          status: 'scheduled' as const,
          notes: formData.projectDescription,
        })
        .select('id')
        .single()

      if (sessionError ?? !sessionData) {
        throw sessionError ?? new Error('Failed to create session')
      }

      const sessionId = (sessionData as { id: string }).id
      router.push(`/consult/session?id=${sessionId}`)
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-3xl mx-auto mb-6">
            ✉️
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">Check your email</h2>
          <p className="text-[#888888] mb-6">
            We&apos;ve sent a magic link to{' '}
            <span className="text-white">{formData.email}</span>.
            Click the link to confirm your booking and access your session.
          </p>
          <Link href="/" className="text-sm text-indigo-400 hover:text-indigo-300">
            ← Back to home
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen">
      {/* Nav */}
      <nav className="border-b border-[#1f1f1f] px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center gap-4">
          <Link href="/" className="text-sm text-[#666666] hover:text-white transition-colors">
            ← Home
          </Link>
          <span className="text-[#333333]">/</span>
          <span className="text-sm text-white">Free Consultation</span>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-xs text-green-400 mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
            Free • No commitment
          </div>
          <h1 className="text-4xl font-bold text-white mb-3">
            Book a Free Consultation
          </h1>
          <p className="text-[#888888] leading-relaxed">
            1 hour with a HyperForge architect. We&apos;ll understand your problem and map out
            the best technical approach. Timer is system-enforced.
          </p>
        </div>

        {/* What to expect */}
        <div className="bg-[#111111] border border-[#2a2a2a] rounded-xl p-6 mb-8">
          <h3 className="text-sm font-semibold text-white mb-3">What to expect</h3>
          <ul className="space-y-2">
            {[
              '60-minute structured session (hard timer — enforced server-side)',
              'Architectural deep-dive on your problem',
              '15-minute warning at 45 minutes',
              'AI-generated session summary delivered after',
              'Zero sales pressure — conceptual only',
            ].map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm text-[#888888]">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 flex-shrink-0 mt-1.5" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* Form */}
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5">
          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-[#aaaaaa] mb-1.5">
              Full Name <span className="text-indigo-400">*</span>
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              placeholder="Jane Smith"
              className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-4 py-2.5 text-sm text-white placeholder-[#555555] focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#aaaaaa] mb-1.5">
              Email <span className="text-indigo-400">*</span>
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              placeholder="jane@company.com"
              className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-4 py-2.5 text-sm text-white placeholder-[#555555] focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#aaaaaa] mb-1.5">
              Describe your project <span className="text-indigo-400">*</span>
            </label>
            <textarea
              name="projectDescription"
              value={formData.projectDescription}
              onChange={handleChange}
              required
              rows={4}
              placeholder="What are you trying to build? What problem are you solving? What does success look like?"
              className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-4 py-2.5 text-sm text-white placeholder-[#555555] focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl px-8 py-3.5 font-semibold transition-colors text-sm"
          >
            {loading ? 'Booking…' : 'Book Free Consultation →'}
          </button>

          <p className="text-xs text-[#555555] text-center">
            A confirmation link will be sent to your email. The session timer starts when you click &ldquo;Start Session&rdquo;.
          </p>
        </form>
      </div>
    </main>
  )
}
