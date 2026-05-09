/**
 * timer.test.ts
 * Tests timer state machine logic and transition conditions.
 * Mirrors the session-timer edge function state machine.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { formatDuration, elapsedSeconds, remainingSeconds, minutesElapsed } from '@/lib/utils'

// ─── Timer utility tests ──────────────────────────────────────────────────────

describe('formatDuration', () => {
  it('formats zero as 00:00', () => {
    expect(formatDuration(0)).toBe('00:00')
  })

  it('formats 90 seconds as 01:30', () => {
    expect(formatDuration(90)).toBe('01:30')
  })

  it('formats 3600 seconds as 60:00', () => {
    expect(formatDuration(3600)).toBe('60:00')
  })

  it('formats 2700 seconds (45 min) as 45:00', () => {
    expect(formatDuration(2700)).toBe('45:00')
  })

  it('pads single-digit seconds', () => {
    expect(formatDuration(65)).toBe('01:05')
  })
})

// ─── Session state machine logic ─────────────────────────────────────────────

type SessionStatus = 'scheduled' | 'active' | 'warned' | 'ended'

interface SessionState {
  id: string
  status: SessionStatus
  started_at: string | null
  warned_at: string | null
  ended_at: string | null
}

const SESSION_WARNING_MINUTES = 45
const SESSION_END_MINUTES = 60

interface TimerAction {
  type: 'WARN' | 'END' | 'NONE'
  sessionId: string
}

function evaluateSession(session: SessionState, now: Date): TimerAction {
  if (!session.started_at || session.status === 'ended') {
    return { type: 'NONE', sessionId: session.id }
  }

  const startedAt = new Date(session.started_at)
  const elapsedMs = now.getTime() - startedAt.getTime()
  const elapsedMinutes = elapsedMs / 60_000

  if (elapsedMinutes >= SESSION_END_MINUTES && !session.ended_at) {
    return { type: 'END', sessionId: session.id }
  }

  if (
    elapsedMinutes >= SESSION_WARNING_MINUTES &&
    session.status === 'active' &&
    !session.warned_at
  ) {
    return { type: 'WARN', sessionId: session.id }
  }

  return { type: 'NONE', sessionId: session.id }
}

describe('Session timer state machine', () => {
  let now: Date

  beforeEach(() => {
    now = new Date('2026-05-08T12:00:00Z')
  })

  function makeSession(
    overrides: Partial<SessionState> = {}
  ): SessionState {
    return {
      id: 'session-1',
      status: 'active',
      started_at: null,
      warned_at: null,
      ended_at: null,
      ...overrides,
    }
  }

  function minutesAgo(minutes: number): string {
    return new Date(now.getTime() - minutes * 60_000).toISOString()
  }

  describe('NONE actions', () => {
    it('does nothing for scheduled sessions', () => {
      const session = makeSession({ status: 'scheduled', started_at: null })
      expect(evaluateSession(session, now).type).toBe('NONE')
    })

    it('does nothing for ended sessions', () => {
      const session = makeSession({
        status: 'ended',
        started_at: minutesAgo(70),
        ended_at: now.toISOString(),
      })
      expect(evaluateSession(session, now).type).toBe('NONE')
    })

    it('does nothing for sessions under 45 minutes', () => {
      const session = makeSession({ started_at: minutesAgo(30) })
      expect(evaluateSession(session, now).type).toBe('NONE')
    })

    it('does nothing for warned sessions between 45–59 minutes', () => {
      const session = makeSession({
        status: 'warned',
        started_at: minutesAgo(50),
        warned_at: minutesAgo(5),
      })
      expect(evaluateSession(session, now).type).toBe('NONE')
    })
  })

  describe('WARN action at 45 minutes', () => {
    it('emits WARN when exactly 45 minutes elapsed', () => {
      const session = makeSession({ started_at: minutesAgo(45) })
      expect(evaluateSession(session, now).type).toBe('WARN')
    })

    it('emits WARN when 50 minutes elapsed and not yet warned', () => {
      const session = makeSession({ started_at: minutesAgo(50) })
      expect(evaluateSession(session, now).type).toBe('WARN')
    })

    it('does NOT warn if already warned', () => {
      const session = makeSession({
        started_at: minutesAgo(50),
        status: 'warned',
        warned_at: minutesAgo(5),
      })
      expect(evaluateSession(session, now).type).toBe('NONE')
    })

    it('does NOT warn if already ended', () => {
      const session = makeSession({
        status: 'ended',
        started_at: minutesAgo(65),
        ended_at: minutesAgo(5),
      })
      expect(evaluateSession(session, now).type).toBe('NONE')
    })
  })

  describe('END action at 60 minutes', () => {
    it('emits END when exactly 60 minutes elapsed', () => {
      const session = makeSession({
        status: 'warned',
        started_at: minutesAgo(60),
        warned_at: minutesAgo(15),
      })
      expect(evaluateSession(session, now).type).toBe('END')
    })

    it('emits END when 65 minutes elapsed', () => {
      const session = makeSession({
        status: 'warned',
        started_at: minutesAgo(65),
        warned_at: minutesAgo(20),
      })
      expect(evaluateSession(session, now).type).toBe('END')
    })

    it('takes precedence over WARN at 60+ minutes', () => {
      // Session that was never warned (edge case)
      const session = makeSession({ started_at: minutesAgo(61) })
      expect(evaluateSession(session, now).type).toBe('END')
    })

    it('does NOT end if ended_at is already set', () => {
      const session = makeSession({
        status: 'ended',
        started_at: minutesAgo(70),
        ended_at: minutesAgo(10),
      })
      expect(evaluateSession(session, now).type).toBe('NONE')
    })
  })

  describe('State transition sequence', () => {
    it('follows correct lifecycle: scheduled → active → warned → ended', () => {
      // t=0: scheduled
      const scheduled = makeSession({ status: 'scheduled', started_at: null })
      expect(evaluateSession(scheduled, now).type).toBe('NONE')

      // t=30min: active, no action
      const at30 = makeSession({ started_at: minutesAgo(30) })
      expect(evaluateSession(at30, now).type).toBe('NONE')

      // t=45min: should warn
      const at45 = makeSession({ started_at: minutesAgo(45) })
      const warnAction = evaluateSession(at45, now)
      expect(warnAction.type).toBe('WARN')

      // t=50min: already warned, no action
      const at50Warned = makeSession({
        status: 'warned',
        started_at: minutesAgo(50),
        warned_at: minutesAgo(5),
      })
      expect(evaluateSession(at50Warned, now).type).toBe('NONE')

      // t=60min: should end
      const at60 = makeSession({
        status: 'warned',
        started_at: minutesAgo(60),
        warned_at: minutesAgo(15),
      })
      expect(evaluateSession(at60, now).type).toBe('END')
    })
  })
})

// ─── Elapsed/remaining utilities ─────────────────────────────────────────────

describe('Timer utilities with mocked time', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-08T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('elapsedSeconds returns correct seconds', () => {
    const startedAt = new Date(Date.now() - 90_000).toISOString() // 90s ago
    expect(elapsedSeconds(startedAt)).toBe(90)
  })

  it('remainingSeconds returns correct seconds', () => {
    const startedAt = new Date(Date.now() - 10 * 60_000).toISOString() // 10min ago
    expect(remainingSeconds(startedAt, 60 * 60)).toBe(50 * 60) // 50min left
  })

  it('remainingSeconds floors at 0 (never negative)', () => {
    const startedAt = new Date(Date.now() - 70 * 60_000).toISOString() // 70min ago
    expect(remainingSeconds(startedAt, 60 * 60)).toBe(0)
  })

  it('minutesElapsed returns correct minutes', () => {
    const startedAt = new Date(Date.now() - 47 * 60_000).toISOString() // 47min ago
    expect(minutesElapsed(startedAt)).toBe(47)
  })
})
