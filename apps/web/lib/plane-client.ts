/**
 * Plane client — ALL Plane data requests go through the plane-proxy edge function.
 * NEVER call the Plane API directly from the browser.
 */

export interface PlaneIssue {
  id: string
  sequence_id: number
  name: string
  description_html: string | null
  state: {
    id: string
    name: string
    color: string
    group: string
  }
  priority: 'urgent' | 'high' | 'medium' | 'low' | 'none'
  created_at: string
  updated_at: string
  comments?: PlaneComment[]
}

export interface PlaneComment {
  id: string
  comment_html: string
  created_at: string
  actor: {
    display_name: string
  }
}

export interface PlaneProxyRequest {
  endpoint: string
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  body?: Record<string, unknown>
}

export interface PlaneProxyResponse<T = unknown> {
  data: T
  error?: string
}

const EDGE_FUNCTION_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1`
  : ''

async function callPlaneProxy<T>(
  request: PlaneProxyRequest,
  accessToken: string
): Promise<T> {
  const res = await fetch(`${EDGE_FUNCTION_BASE}/plane-proxy`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(request),
  })

  if (!res.ok) {
    const error = await res.text()
    throw new Error(`plane-proxy error ${res.status}: ${error}`)
  }

  const json: PlaneProxyResponse<T> = await res.json()
  if (json.error) {
    throw new Error(json.error)
  }
  return json.data
}

export async function getProjectIssues(
  projectId: string,
  accessToken: string
): Promise<PlaneIssue[]> {
  return callPlaneProxy<PlaneIssue[]>(
    {
      endpoint: `/workspaces/hyperforge/projects/${projectId}/issues/`,
      method: 'GET',
    },
    accessToken
  )
}

export async function getIssueComments(
  projectId: string,
  issueId: string,
  accessToken: string
): Promise<PlaneComment[]> {
  return callPlaneProxy<PlaneComment[]>(
    {
      endpoint: `/workspaces/hyperforge/projects/${projectId}/issues/${issueId}/comments/`,
      method: 'GET',
    },
    accessToken
  )
}
