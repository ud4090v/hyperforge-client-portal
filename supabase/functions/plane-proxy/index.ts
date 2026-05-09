/**
 * plane-proxy — RBAC wrapper around the Plane API.
 *
 * Responsibilities:
 * 1. Verify Supabase JWT → identify customer
 * 2. Validate requested endpoint is scoped to their project
 * 3. Call Plane API with PLANE_API_KEY_NOVA
 * 4. Filter response: strip internal fields + comments
 * 5. Write to audit_log
 * 6. Return filtered data
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProxyRequest {
  endpoint: string
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  body?: Record<string, unknown>
}

interface PlaneComment {
  id: string
  comment_html: string
  [key: string]: unknown
}

interface PlaneIssue {
  cost_estimate?: unknown
  internal_notes?: unknown
  agent_notes?: unknown
  comments?: PlaneComment[]
  [key: string]: unknown
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PLANE_BASE_URL = 'http://localhost:8080/api/v1'
const HYPERFORGE_WORKSPACE = 'hyperforge'

// Patterns that mark a comment as internal — must NOT be shown to customers
const INTERNAL_COMMENT_PATTERNS = [
  /\[internal\]/i,
  /\[cost\]/i,
  /\[agent-note\]/i,
  /💰/,
  /^🏗️/,
]

function isInternalComment(commentHtml: string): boolean {
  const stripped = commentHtml.replace(/<[^>]*>/g, '').trim()
  return INTERNAL_COMMENT_PATTERNS.some((pattern) => pattern.test(stripped))
}

function filterIssue(issue: PlaneIssue): PlaneIssue {
  const filtered = { ...issue }
  delete filtered.cost_estimate
  delete filtered.internal_notes
  delete filtered.agent_notes

  if (Array.isArray(filtered.comments)) {
    filtered.comments = (filtered.comments as PlaneComment[]).filter(
      (c: PlaneComment) => !isInternalComment(c.comment_html ?? '')
    )
  }

  return filtered
}

function filterResponse(data: unknown): unknown {
  if (Array.isArray(data)) {
    return data.map((item) =>
      item && typeof item === 'object' ? filterIssue(item as PlaneIssue) : item
    )
  }
  if (data && typeof data === 'object') {
    // Paginated response shape: { results: [...], count: N }
    const obj = data as Record<string, unknown>
    if (Array.isArray(obj.results)) {
      return {
        ...obj,
        results: (obj.results as PlaneIssue[]).map(filterIssue),
      }
    }
    return filterIssue(data as PlaneIssue)
  }
  return data
}

// ─── Endpoint validation ──────────────────────────────────────────────────────

function validateEndpoint(endpoint: string, planeProjectId: string): boolean {
  // Endpoint must be scoped to the customer's project
  const expectedPrefix = `/workspaces/${HYPERFORGE_WORKSPACE}/projects/${planeProjectId}/`
  return endpoint.startsWith(expectedPrefix)
}

// ─── Handler ─────────────────────────────────────────────────────────────────

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

  // ── 1. Env vars ─────────────────────────────────────────────────────────────
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const planeApiKey = Deno.env.get('PLANE_API_KEY_NOVA')

  if (!supabaseUrl || !serviceKey || !planeApiKey) {
    return new Response(JSON.stringify({ error: 'Missing env vars' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // ── 2. Auth: verify JWT ──────────────────────────────────────────────────────
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Missing authorization' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  const userJwt = authHeader.slice(7)

  // Service-role client for DB ops
  const supabase = createClient(supabaseUrl, serviceKey)

  // Verify the user JWT
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(userJwt)

  if (userError || !user) {
    return new Response(JSON.stringify({ error: 'Invalid token' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // ── 3. Look up customer + their project ─────────────────────────────────────
  const { data: customer, error: customerError } = await supabase
    .from('customers')
    .select('id')
    .eq('auth_id', user.id)
    .single()

  if (customerError || !customer) {
    return new Response(JSON.stringify({ error: 'Customer not found' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { data: projectRow, error: projectError } = await supabase
    .from('customer_projects')
    .select('plane_project_id')
    .eq('customer_id', customer.id)
    .single()

  if (projectError || !projectRow) {
    return new Response(
      JSON.stringify({ error: 'No project found for customer' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const planeProjectId = projectRow.plane_project_id

  // ── 4. Parse request body ────────────────────────────────────────────────────
  let proxyReq: ProxyRequest
  try {
    proxyReq = (await req.json()) as ProxyRequest
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // ── 5. Validate endpoint scoping ─────────────────────────────────────────────
  if (!validateEndpoint(proxyReq.endpoint, planeProjectId)) {
    return new Response(
      JSON.stringify({ error: 'Endpoint not authorized for this customer' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    )
  }

  // ── 6. Call Plane API ────────────────────────────────────────────────────────
  const planeUrl = `${PLANE_BASE_URL}${proxyReq.endpoint}`
  const planeMethod = proxyReq.method ?? 'GET'

  let planeRes: Response
  try {
    planeRes = await fetch(planeUrl, {
      method: planeMethod,
      headers: {
        'X-Api-Key': planeApiKey,
        'Content-Type': 'application/json',
      },
      body:
        planeMethod !== 'GET' && proxyReq.body
          ? JSON.stringify(proxyReq.body)
          : undefined,
    })
  } catch (fetchErr) {
    return new Response(
      JSON.stringify({ error: `Plane API unreachable: ${String(fetchErr)}` }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    )
  }

  if (!planeRes.ok) {
    const errText = await planeRes.text()
    return new Response(
      JSON.stringify({ error: `Plane API error ${planeRes.status}: ${errText}` }),
      { status: planeRes.status, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const rawData: unknown = await planeRes.json()

  // ── 7. Filter response ───────────────────────────────────────────────────────
  const filteredData = filterResponse(rawData)

  // ── 8. Write to audit_log ────────────────────────────────────────────────────
  const ip =
    req.headers.get('x-forwarded-for') ??
    req.headers.get('x-real-ip') ??
    'unknown'

  await supabase.from('audit_log').insert({
    customer_id: customer.id,
    project_id: planeProjectId,
    endpoint: proxyReq.endpoint,
    action: planeMethod,
    ip_address: ip,
  })

  // ── 9. Return ────────────────────────────────────────────────────────────────
  return new Response(JSON.stringify({ data: filteredData }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  })
})
