'use client'

import { useEffect, useState, useCallback } from 'react'
import { formatDuration, remainingSeconds } from '@/lib/utils'

export type SessionStatus = 'scheduled' | 'active' | 'warned' | 'ended'

interface ConsultTimerProps {
  sessionId: string
  startedAt: string | null
  initialStatus: SessionStatus
  onWarning?: () => void
  onEnded?: (summary: string) => void
}

const TOTAL_SECONDS = 60 * 60 // 60 minutes
const WARNING_SECONDS = 45 * 60 // 45 minutes

export function ConsultTimer({
  sessionId,
  startedAt,
  initialStatus,
  onWarning,
  onEnded,
}: ConsultTimerProps) {
  const [status, setStatus] = useState<SessionStatus>(initialStatus)
  const [secondsLeft, setSecondsLeft] = useState<number>(
    startedAt ? remainingSeconds(startedAt, TOTAL_SECONDS) : TOTAL_SECONDS
  )
  const [showWarning, setShowWarning] = useState(initialStatus === 'warned')

  // Tick every second
  useEffect(() => {
    if (!startedAt || status === 'ended' || status === 'scheduled') return

    const interval = setInterval(() => {
      const remaining = remainingSeconds(startedAt, TOTAL_SECONDS)
      setSecondsLeft(remaining)

      // Warning at 45 min (from server clock perspective, but display updates here)
      if (remaining <= TOTAL_SECONDS - WARNING_SECONDS && status === 'active') {
        setStatus('warned')
        setShowWarning(true)
        onWarning?.()
      }

      // Ended — server controls this, but UI also updates display
      if (remaining === 0) {
        clearInterval(interval)
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [startedAt, status, onWarning])

  // Subscribe to Supabase realtime events (SERVER is authoritative)
  useEffect(() => {
    if (typeof window === 'undefined') return

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!supabaseUrl || !supabaseAnonKey) return

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let channelRef: any = null

    void import('@supabase/supabase-js').then(({ createClient }) => {
      const supabase = createClient(supabaseUrl, supabaseAnonKey)
      const channel = supabase.channel(`session:${sessionId}`)

      channel
        .on('broadcast', { event: 'SESSION_WARNING' }, () => {
          setStatus('warned')
          setShowWarning(true)
          onWarning?.()
        })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .on('broadcast', { event: 'SESSION_ENDED' }, (payload: any) => {
          setStatus('ended')
          setSecondsLeft(0)
          const summary = (payload?.payload as { summary?: string })?.summary ?? ''
          onEnded?.(summary)
        })
        .subscribe()

      channelRef = channel
    })

    return () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      void (channelRef as any)?.unsubscribe?.()
    }
  }, [sessionId, onWarning, onEnded])

  const percentage = TOTAL_SECONDS > 0 ? (secondsLeft / TOTAL_SECONDS) * 100 : 0
  const isWarning = status === 'warned' || secondsLeft <= TOTAL_SECONDS - WARNING_SECONDS
  const isEnded = status === 'ended'

  const strokeColor = isEnded
    ? '#ef4444'
    : isWarning
    ? '#f59e0b'
    : '#6366f1'

  const circumference = 2 * Math.PI * 54

  return (
    <div className="relative">
      {/* Non-dismissable warning banner */}
      {showWarning && !isEnded && (
        <div
          className="mb-4 p-4 rounded-xl border border-amber-500/30 bg-amber-500/10"
          role="alert"
          aria-live="assertive"
          data-testid="warning-banner"
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <p className="text-amber-400 font-semibold">15 Minutes Remaining</p>
              <p className="text-sm text-amber-300/80">
                Your consultation session will end at the 60-minute mark. This cannot be extended.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Timer display */}
      <div
        className="flex flex-col items-center justify-center gap-4"
        data-testid="timer-display"
      >
        <div className="relative w-32 h-32">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
            {/* Background circle */}
            <circle
              cx="60"
              cy="60"
              r="54"
              fill="none"
              stroke="#2a2a2a"
              strokeWidth="8"
            />
            {/* Progress circle */}
            <circle
              cx="60"
              cy="60"
              r="54"
              fill="none"
              stroke={strokeColor}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - percentage / 100)}
              style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s ease' }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span
              className="text-2xl font-bold font-mono tabular-nums"
              style={{ color: strokeColor }}
            >
              {isEnded ? '00:00' : formatDuration(secondsLeft)}
            </span>
          </div>
        </div>

        {/* Status label */}
        <div className="text-center">
          {isEnded ? (
            <p className="text-red-400 font-semibold">Session Ended</p>
          ) : isWarning ? (
            <p className="text-amber-400 font-semibold">Session Ending Soon</p>
          ) : status === 'scheduled' ? (
            <p className="text-[#888888]">Session not started</p>
          ) : (
            <p className="text-[#888888]">Session in progress</p>
          )}
          <p className="text-xs text-[#555555] mt-1">
            {isEnded
              ? 'Your session summary is ready below'
              : isWarning
              ? `${Math.ceil(secondsLeft / 60)} minutes left — cannot be extended`
              : 'Timer runs server-side • cannot be dismissed'}
          </p>
        </div>
      </div>
    </div>
  )
}

export default ConsultTimer
