/**
 * create-project — Provision a Plane project after intake.
 *
 * POST body: {
 *   customerId: string,
 *   projectName: string,
 *   templateSlug: string,
 *   intakeSummary?: string
 * }
 *
 * Flow:
 * 1. Create Plane project in hyperforge workspace
 * 2. Insert customer_projects row
 * 3. Post initial customer-facing comment
 * 4. Return plane_project_id
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface CreateProjectRequest {
  projectName: string
  templateSlug: string
  intakeSummary?: string
}

interface PlaneProject {
  id: string
  identifier: string
  name: string
  [key: string]: unknown
}

const PLANE_BASE_URL = 'http://localhost:8080/api/v1'
const HYPERFORGE_WORKSPACE = 'hyperforge'

// Generate a safe Plane project identifier (max 12 chars, uppercase alphanumeric)
function makeIdentifier(name: string): string {
  return name
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .substring(0, 12) +
    Math.random().toString(36).substring(2, 5).toUpperCase()
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
  const planeApiKey = Deno.env.get('PLANE_API_KEY_NOVA')

  if (!supabaseUrl || !serviceKey || !planeApiKey) {
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

  // Get customer record
  const { data: customer, error: customerError } = await supabase
    .from('customers')
    .select('id, email, name')
    .eq('auth_id', user.id)
    .single()

  if (customerError || !customer) {
    return new Response(JSON.stringify({ error: 'Customer not found' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let body: CreateProjectRequest
  try {
    body = (await req.json()) as CreateProjectRequest
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (!body.projectName || !body.templateSlug) {
    return new Response(JSON.stringify({ error: 'projectName and templateSlug required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // ── 1. Create Plane project ──────────────────────────────────────────────────
  const identifier = makeIdentifier(body.projectName)

  const planeRes = await fetch(
    `${PLANE_BASE_URL}/workspaces/${HYPERFORGE_WORKSPACE}/projects/`,
    {
      method: 'POST',
      headers: {
        'X-Api-Key': planeApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: `[HCP] ${body.projectName}`,
        identifier,
        description: body.intakeSummary ?? `Client project — template: ${body.templateSlug}`,
        network: 2, // secret
      }),
    }
  )

  if (!planeRes.ok) {
    const errText = await planeRes.text()
    return new Response(
      JSON.stringify({ error: `Plane project creation failed: ${errText}` }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const planeProject = (await planeRes.json()) as PlaneProject

  // ── 2. Insert customer_projects row ──────────────────────────────────────────
  const { error: insertError } = await supabase
    .from('customer_projects')
    .insert({
      customer_id: customer.id,
      plane_project_id: planeProject.id,
      plane_project_slug: planeProject.identifier,
      template_slug: body.templateSlug,
    })

  if (insertError) {
    console.error('Failed to insert customer_projects:', insertError)
    // Don't fail — project was created, just log
  }

  // ── 3. Post initial customer-facing comment ───────────────────────────────────
  // Get the first issue in the project to post a welcome comment, or use a dedicated issue
  // For now, post a project-level activity note
  try {
    await fetch(
      `${PLANE_BASE_URL}/workspaces/${HYPERFORGE_WORKSPACE}/projects/${planeProject.id}/issues/`,
      {
        method: 'POST',
        headers: {
          'X-Api-Key': planeApiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Project Setup Complete',
          description_html:
            '<p>Your project has been set up. We\'ll be in touch within 1 business day.</p>',
          priority: 'medium',
          state: 'backlog',
        }),
      }
    )
  } catch (err) {
    console.error('Failed to create welcome issue:', err)
  }

  // ── 4. Update customer tier ───────────────────────────────────────────────────
  await supabase
    .from('customers')
    .update({ tier: 'template' })
    .eq('id', customer.id)

  return new Response(
    JSON.stringify({
      data: {
        planeProjectId: planeProject.id,
        planeProjectSlug: planeProject.identifier,
        message: "Your project has been set up. We'll be in touch within 1 business day.",
      },
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    }
  )
})
