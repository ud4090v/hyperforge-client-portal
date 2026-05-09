'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import Link from 'next/link'
import { ConsultTimer } from '@/components/ConsultTimer'
import { SessionSummary } from '@/components/SessionSummary'
import { createBrowserClient } from '@/lib/supabase'
import type { SessionStatus } from '@/components/ConsultTimer'

interface SessionData {
  id: string
  customer_id: string
  status: SessionStatus
  started_at: string | null
  warned_at: string | null
  ended_at: string | null
  summary: string | null
  notes: string | null
}

interface SummaryResult {
  summary: string
  nextSteps: string[]
  upgradePrompt: string
}

function SessionPageContent() {
  const searchParams = useSearchParams()
  const sessionId = searchParams.get('id')

  const [session, setSession] = useState<SessionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isLocked, setIsLocked] = useState(false)
  const [summaryResult, setSummaryResult] = useState<SummaryResult | null>(null)
  const [notes, setNotes] = useState('')
  const [startingSession, setStartingSession] = useState(false)

  const fetchSession = useCallback(async () => {
    if (!sessionId) return
    const supabase = createBrowserClient()
    const { data, error: fetchError } = await supabase
      .from('consult_sessions')
      .select('*')
      .eq('id', sessionId)
      .single()

    if (fetchError ?? !data) {
      setError('Session not found.')
      setLoading(false)
      return
    }

    const sessionRow = data as SessionData
    setSession(sessionRow)
    setNotes(sessionRow.notes ?? '')
    if (sessionRow.status === 'ended') {
      setIsLocked(true)
    }
    setLoading(false)
  }, [sessionId])

  useEffect(() => {
    void fetchSession()
  }, [fetchSession])

  const handleStartSession = async () => {
    if (!sessionId || !session) return
    setStartingSession(true)
    const supabase = createBrowserClient()
    const { error: updateError } = await supabase
      .from('consult_sessions')
      .update({
        status: 'active' as const,
        started_at: new Date().toISOString(),
      })
      .eq('id', sessionId)

    if (updateError) {
      setError('Failed to start session.')
    } else {
      await fetchSession()
    }
    setStartingSession(false)
  }

  const handleWarning = useCallback(() => {
    // Warning state is purely display — server controls it
  }, [])

  const handleEnded = useCallback(
    async (serverSummary: string) => {
      setIsLocked(true)

      // Try to get structured summary from intake-ai
      const supabase = createBrowserClient()
      const { data: authData } = await supabase.auth.getSession()
      const authSession = authData?.session

      if (authSession?.access_token) {
        try {
          const res = await fetch(
            `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/intake-ai`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${authSession.access_token}`,
              },
              body: JSON.stringify({
                type: 'session_summary',
                payload: { notes, sessionId },
              }),
            }
          )
          if (res.ok) {
            const json = (await res.json()) as { data: SummaryResult }
            setSummaryResult(json.data)
            return
          }
        } catch {
          // Fall through to server summary
        }
      }

      // Fallback to server-generated summary
      setSummaryResult({
        summary: serverSummary || 'Session complete.',
        nextSteps: ['Review session notes', 'Follow up with your HyperForge contact'],
        upgradePrompt:
          'Ready to take the next step? Our paid design retainer gives you extended scoping sessions with senior architects.',
      })
    },
    [notes, sessionId]
  )

  const handleSaveNotes = async () => {
    if (!sessionId || isLocked) return
    const supabase = createBrowserClient()
    await supabase
      .from('consult_sessions')
      .update({ notes })
      .eq('id', sessionId)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error ?? !session) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error ?? 'Session not found.'}</p>
          <Link href="/consult" className="text-sm text-indigo-400 hover:text-indigo-300">
            ← Book a consultation
          </Link>
        </div>
      </div>
    )
  }

  return (
    <main className="min-h-screen">
      {/* Nav */}
      <nav className="border-b border-[#1f1f1f] px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-sm text-[#666666] hover:text-white transition-colors">
              HyperForge
            </Link>
            <span className="text-[#333333]">/</span>
            <span className="text-sm text-white">Consultation Session</span>
          </div>
          <span className="text-xs text-[#555555] font-mono">{session.id.slice(0, 8)}…</span>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: timer */}
          <div className="lg:col-span-1">
            <div className="bg-[#111111] border border-[#2a2a2a] rounded-xl p-6 sticky top-6">
              <h2 className="text-sm font-semibold text-[#aaaaaa] mb-6 uppercase tracking-wider">
                Session Timer
              </h2>

              {session.status === 'scheduled' ? (
                <div className="text-center space-y-4">
                  <div className="w-24 h-24 rounded-full border-2 border-[#2a2a2a] flex items-center justify-center mx-auto">
                    <span className="text-3xl">⏱</span>
                  </div>
                  <p className="text-sm text-[#888888]">
                    Session is ready. The 60-minute timer starts when you click below.
                  </p>
                  <button
                    onClick={() => void handleStartSession()}
                    disabled={startingSession}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg px-4 py-2.5 text-sm font-medium transition-colors"
                  >
                    {startingSession ? 'Starting…' : 'Start Session'}
                  </button>
                  <p className="text-xs text-[#444444]">
                    Once started, the timer cannot be paused or extended.
                  </p>
                </div>
              ) : (
                <ConsultTimer
                  sessionId={session.id}
                  startedAt={session.started_at}
                  initialStatus={session.status}
                  onWarning={handleWarning}
                  onEnded={(s) => void handleEnded(s)}
                />
              )}
            </div>
          </div>

          {/* Right: content area */}
          <div className="lg:col-span-2 space-y-6">
            {/* Locked overlay for ended sessions */}
            {isLocked && summaryResult && (
              <div>
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6">
                  <p className="text-sm text-red-400 font-medium">
                    ⏹ Session has ended. The input area below is locked.
                  </p>
                </div>
                <SessionSummary
                  summary={summaryResult.summary}
                  nextSteps={summaryResult.nextSteps}
                  upgradePrompt={summaryResult.upgradePrompt}
                />
              </div>
            )}

            {/* Notes area — locked when session ends */}
            <div className="bg-[#111111] border border-[#2a2a2a] rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white">Session Notes</h2>
                {!isLocked && session.status === 'active' && (
                  <button
                    onClick={() => void handleSaveNotes()}
                    className="text-xs text-indigo-400 hover:text-indigo-300 border border-indigo-500/30 rounded px-2.5 py-1 transition-colors"
                  >
                    Save
                  </button>
                )}
              </div>

              {isLocked ? (
                <div className="relative">
                  <div
                    className="pointer-events-none opacity-40 whitespace-pre-wrap text-sm text-[#888888] min-h-[200px] p-4 bg-[#0d0d0d] rounded-lg border border-[#1f1f1f]"
                    aria-label="Session notes (locked)"
                  >
                    {notes || 'No notes recorded during this session.'}
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-[#333333] text-sm">🔒 Session ended — notes locked</span>
                  </div>
                </div>
              ) : (
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  onBlur={() => void handleSaveNotes()}
                  disabled={isLocked || session.status === 'scheduled'}
                  placeholder={
                    session.status === 'scheduled'
                      ? 'Start the session to begin taking notes…'
                      : 'Take notes during your session… (auto-saved on blur)'
                  }
                  rows={12}
                  className="w-full bg-[#0d0d0d] border border-[#1f1f1f] rounded-lg px-4 py-3 text-sm text-white placeholder-[#444444] focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all resize-none disabled:opacity-50 disabled:cursor-not-allowed"
                />
              )}
            </div>

            {/* Session info */}
            <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-xl p-4">
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-[#444444]">Session ID</span>
                  <p className="text-[#888888] font-mono mt-0.5">{session.id.slice(0, 16)}…</p>
                </div>
                <div>
                  <span className="text-[#444444]">Status</span>
                  <p className="text-[#888888] capitalize mt-0.5">{session.status}</p>
                </div>
                {session.started_at && (
                  <div>
                    <span className="text-[#444444]">Started</span>
                    <p className="text-[#888888] mt-0.5">
                      {new Date(session.started_at).toLocaleTimeString()}
                    </p>
                  </div>
                )}
                {session.ended_at && (
                  <div>
                    <span className="text-[#444444]">Ended</span>
                    <p className="text-[#888888] mt-0.5">
                      {new Date(session.ended_at).toLocaleTimeString()}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}

export default function ConsultSessionPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <SessionPageContent />
    </Suspense>
  )
}
