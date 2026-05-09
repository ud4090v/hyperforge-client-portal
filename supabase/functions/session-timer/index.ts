/**
 * session-timer — Server-side 60-minute enforcement.
 * Called by pg_cron every minute.
 *
 * State machine:
 *   ACTIVE  → (45min elapsed) → WARNED  (broadcast SESSION_WARNING)
 *   WARNED  → (60min elapsed) → ENDED   (AI summary + broadcast SESSION_ENDED)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SESSION_WARNING_MINUTES = 45
const SESSION_END_MINUTES = 60

interface ConsultSession {
  id: string
  customer_id: string
  status: string
  started_at: string
  warned_at: string | null
  ended_at: string | null
  notes: string | null
}

Deno.serve(async (_req: Request) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const openaiKey = Deno.env.get('OPENAI_API_KEY')

  if (!supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: 'Missing env vars' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(supabaseUrl, serviceKey)
  const now = new Date()

  // Fetch all active sessions (active + warned)
  const { data: sessions, error } = await supabase
    .from('consult_sessions')
    .select('id, customer_id, status, started_at, warned_at, ended_at, notes')
    .in('status', ['active', 'warned'])
    .not('started_at', 'is', null)

  if (error) {
    console.error('Error fetching sessions:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const results: Array<{ id: string; action: string; error?: string }> = []

  for (const session of (sessions ?? []) as ConsultSession[]) {
    const startedAt = new Date(session.started_at)
    const elapsedMs = now.getTime() - startedAt.getTime()
    const elapsedMinutes = elapsedMs / 60_000

    try {
      // ── 60-min hard stop ────────────────────────────────────────────────────
      if (elapsedMinutes >= SESSION_END_MINUTES && !session.ended_at) {
        // Generate AI summary
        let summary = 'Session summary unavailable.'
        if (openaiKey) {
          try {
            const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${openaiKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model: 'gpt-4o',
                messages: [
                  {
                    role: 'system',
                    content:
                      'You are a professional technical consultant. Generate a concise 2–3 sentence summary of a client consultation session. Focus on key topics discussed and next steps.',
                  },
                  {
                    role: 'user',
                    content: `Consultation session notes: ${session.notes ?? 'No notes recorded.'}
Session duration: ${Math.floor(elapsedMinutes)} minutes.
Please provide a professional session summary and suggested next steps.`,
                  },
                ],
                max_tokens: 300,
                temperature: 0.3,
              }),
            })
            if (aiRes.ok) {
              const aiData = await aiRes.json() as {
                choices: Array<{ message: { content: string } }>
              }
              summary = aiData.choices[0]?.message?.content ?? summary
            }
          } catch (aiErr) {
            console.error('OpenAI summary failed:', aiErr)
          }
        }

        // Update session to ended
        await supabase
          .from('consult_sessions')
          .update({
            status: 'ended',
            ended_at: now.toISOString(),
            summary,
          })
          .eq('id', session.id)

        // Broadcast realtime event
        await supabase.channel(`session:${session.id}`).send({
          type: 'broadcast',
          event: 'SESSION_ENDED',
          payload: {
            sessionId: session.id,
            summary,
            endedAt: now.toISOString(),
          },
        })

        results.push({ id: session.id, action: 'ended' })

      // ── 45-min warning ──────────────────────────────────────────────────────
      } else if (
        elapsedMinutes >= SESSION_WARNING_MINUTES &&
        session.status === 'active' &&
        !session.warned_at
      ) {
        const minutesLeft = Math.ceil(SESSION_END_MINUTES - elapsedMinutes)

        await supabase
          .from('consult_sessions')
          .update({
            status: 'warned',
            warned_at: now.toISOString(),
          })
          .eq('id', session.id)

        // Broadcast realtime event
        await supabase.channel(`session:${session.id}`).send({
          type: 'broadcast',
          event: 'SESSION_WARNING',
          payload: {
            sessionId: session.id,
            minutesLeft,
            warnedAt: now.toISOString(),
          },
        })

        results.push({ id: session.id, action: 'warned' })
      }
    } catch (err) {
      console.error(`Error processing session ${session.id}:`, err)
      results.push({ id: session.id, action: 'error', error: String(err) })
    }
  }

  return new Response(
    JSON.stringify({
      processed: sessions?.length ?? 0,
      results,
      timestamp: now.toISOString(),
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  )
})
