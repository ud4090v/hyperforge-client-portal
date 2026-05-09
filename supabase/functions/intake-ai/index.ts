/**
 * intake-ai — AI intake summarization.
 *
 * POST body:
 *   { type: 'template_intake', payload: { formAnswers: Record<string, string>, templateSlug: string } }
 *   { type: 'session_summary', payload: { notes: string, sessionId: string } }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface TemplateIntakePayload {
  formAnswers: Record<string, string>
  templateSlug: string
  customerEmail?: string
}

interface SessionSummaryPayload {
  notes: string
  sessionId: string
}

type IntakeRequest =
  | { type: 'template_intake'; payload: TemplateIntakePayload }
  | { type: 'session_summary'; payload: SessionSummaryPayload }

interface TemplateIntakeResult {
  summary: string
  estimatedScope: string
  suggestedTemplate: string
}

interface SessionSummaryResult {
  summary: string
  nextSteps: string[]
  upgradePrompt: string
}

async function callOpenAI(
  apiKey: string,
  messages: Array<{ role: string; content: string }>,
  maxTokens = 500
): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages,
      max_tokens: maxTokens,
      temperature: 0.3,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`OpenAI error ${res.status}: ${err}`)
  }

  const data = await res.json() as {
    choices: Array<{ message: { content: string } }>
  }
  return data.choices[0]?.message?.content ?? ''
}

async function handleTemplateIntake(
  payload: TemplateIntakePayload,
  openaiKey: string
): Promise<TemplateIntakeResult> {
  const answersText = Object.entries(payload.formAnswers)
    .map(([q, a]) => `Q: ${q}\nA: ${a}`)
    .join('\n\n')

  const raw = await callOpenAI(
    openaiKey,
    [
      {
        role: 'system',
        content: `You are a senior technical consultant at HyperForge, a software engineering agency.
Analyze client intake form answers and return a JSON object with:
{
  "summary": "2-3 sentence project overview",
  "estimatedScope": "Brief scope estimate (e.g., '4-6 weeks, 1 developer')",
  "suggestedTemplate": "slug of best matching template (ai-intake | quote-engine | reporting-console)"
}
Return only valid JSON, no markdown.`,
      },
      {
        role: 'user',
        content: `Template selected: ${payload.templateSlug}
Customer: ${payload.customerEmail ?? 'unknown'}

Form answers:
${answersText}`,
      },
    ],
    400
  )

  try {
    return JSON.parse(raw.trim()) as TemplateIntakeResult
  } catch {
    // Fallback if JSON parse fails
    return {
      summary: raw.substring(0, 300),
      estimatedScope: 'To be determined',
      suggestedTemplate: payload.templateSlug,
    }
  }
}

async function handleSessionSummary(
  payload: SessionSummaryPayload,
  openaiKey: string
): Promise<SessionSummaryResult> {
  const raw = await callOpenAI(
    openaiKey,
    [
      {
        role: 'system',
        content: `You are a professional technical consultant summarizing a 1-hour consultation session.
Return a JSON object with:
{
  "summary": "2-3 sentence summary of key discussion points",
  "nextSteps": ["step 1", "step 2", "step 3"],
  "upgradePrompt": "1-2 sentence pitch for the next service tier (paid design retainer or hosted)"
}
Return only valid JSON, no markdown.`,
      },
      {
        role: 'user',
        content: `Session notes:
${payload.notes || 'No notes recorded.'}`,
      },
    ],
    600
  )

  try {
    return JSON.parse(raw.trim()) as SessionSummaryResult
  } catch {
    return {
      summary: raw.substring(0, 300),
      nextSteps: ['Review session notes', 'Schedule follow-up'],
      upgradePrompt:
        'Ready to go deeper? Our paid design retainer gives you extended scoping sessions with our senior architects.',
    }
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      },
    })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const openaiKey = Deno.env.get('OPENAI_API_KEY')

  if (!supabaseUrl || !serviceKey || !openaiKey) {
    return new Response(JSON.stringify({ error: 'Missing env vars' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Verify auth
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Missing authorization' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(supabaseUrl, serviceKey)
  const { data: { user }, error: userError } = await supabase.auth.getUser(
    authHeader.slice(7)
  )
  if (userError || !user) {
    return new Response(JSON.stringify({ error: 'Invalid token' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let body: IntakeRequest
  try {
    body = (await req.json()) as IntakeRequest
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    let result: TemplateIntakeResult | SessionSummaryResult

    if (body.type === 'template_intake') {
      result = await handleTemplateIntake(body.payload as TemplateIntakePayload, openaiKey)
    } else if (body.type === 'session_summary') {
      result = await handleSessionSummary(body.payload as SessionSummaryPayload, openaiKey)
    } else {
      return new Response(JSON.stringify({ error: 'Unknown type' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ data: result }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch (err) {
    console.error('intake-ai error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
