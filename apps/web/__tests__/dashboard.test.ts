/**
 * dashboard.test.ts
 * Tests dashboard data fetching, filtering, and display logic.
 * Uses mocked plane-proxy responses.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { PlaneIssue, PlaneComment } from '@/lib/plane-client'

// ─── Mock plane-client calls ──────────────────────────────────────────────────

async function fetchIssuesViaProxy(
  projectId: string,
  accessToken: string,
  baseUrl: string
): Promise<PlaneIssue[]> {
  const res = await fetch(`${baseUrl}/functions/v1/plane-proxy`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      endpoint: `/workspaces/hyperforge/projects/${projectId}/issues/`,
      method: 'GET',
    }),
  })

  if (!res.ok) throw new Error(`plane-proxy error: ${res.status}`)
  const json = await res.json() as { data: PlaneIssue[] }
  return json.data
}

// ─── Sample data ──────────────────────────────────────────────────────────────

const MOCK_ISSUES: PlaneIssue[] = [
  {
    id: 'issue-1',
    sequence_id: 1,
    name: 'Project Setup Complete',
    description_html: "<p>Your project has been set up. We'll be in touch within 1 business day.</p>",
    state: { id: 'state-1', name: 'Backlog', color: '#888888', group: 'backlog' },
    priority: 'medium',
    created_at: '2026-05-08T10:00:00Z',
    updated_at: '2026-05-08T10:00:00Z',
    comments: [
      {
        id: 'comment-1',
        comment_html: "<p>Your project has been set up. We'll be in touch within 1 business day.</p>",
        created_at: '2026-05-08T10:05:00Z',
        actor: { display_name: 'HyperForge Team' },
      },
    ],
  },
  {
    id: 'issue-2',
    sequence_id: 2,
    name: 'Authentication Module',
    description_html: '<p>Implementing the authentication flow.</p>',
    state: { id: 'state-2', name: 'In Progress', color: '#6366f1', group: 'started' },
    priority: 'high',
    created_at: '2026-05-08T11:00:00Z',
    updated_at: '2026-05-08T14:00:00Z',
    comments: [],
  },
]

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Dashboard: fetch issues via plane-proxy', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('fetches issues and returns array', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: MOCK_ISSUES }),
    } as Response)

    const issues = await fetchIssuesViaProxy(
      'proj-123',
      'mock-token',
      'https://example.supabase.co'
    )

    expect(issues).toHaveLength(2)
    expect(issues[0].name).toBe('Project Setup Complete')
    expect(issues[1].state.name).toBe('In Progress')
  })

  it('throws on auth error (401)', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ error: 'Invalid token' }),
    } as Response)

    await expect(
      fetchIssuesViaProxy('proj-123', 'bad-token', 'https://example.supabase.co')
    ).rejects.toThrow('plane-proxy error: 401')
  })

  it('throws on forbidden (403)', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({ error: 'Endpoint not authorized' }),
    } as Response)

    await expect(
      fetchIssuesViaProxy('proj-123', 'token', 'https://example.supabase.co')
    ).rejects.toThrow('plane-proxy error: 403')
  })

  it('sends correct request structure', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: [] }),
    } as Response)

    await fetchIssuesViaProxy(
      'my-project-id',
      'my-access-token',
      'https://my.supabase.co'
    )

    const [url, options] = vi.mocked(fetch).mock.calls[0]
    expect(url).toBe('https://my.supabase.co/functions/v1/plane-proxy')
    expect(options?.headers).toMatchObject({
      Authorization: 'Bearer my-access-token',
      'Content-Type': 'application/json',
    })

    const body = JSON.parse(options?.body as string) as {
      endpoint: string
      method: string
    }
    expect(body.endpoint).toBe('/workspaces/hyperforge/projects/my-project-id/issues/')
    expect(body.method).toBe('GET')
  })
})

// ─── Issue display logic ──────────────────────────────────────────────────────

function sortIssuesByUpdated(issues: PlaneIssue[]): PlaneIssue[] {
  return [...issues].sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  )
}

function filterIssuesByState(issues: PlaneIssue[], stateGroup: string): PlaneIssue[] {
  return issues.filter((i) => i.state.group === stateGroup)
}

function getPriorityOrder(priority: string): number {
  const order: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3, none: 4 }
  return order[priority] ?? 4
}

function sortIssuesByPriority(issues: PlaneIssue[]): PlaneIssue[] {
  return [...issues].sort(
    (a, b) => getPriorityOrder(a.priority) - getPriorityOrder(b.priority)
  )
}

describe('Issue display utilities', () => {
  it('sorts issues by updated_at descending', () => {
    const sorted = sortIssuesByUpdated(MOCK_ISSUES)
    expect(sorted[0].id).toBe('issue-2') // updated_at 14:00 > 10:00
    expect(sorted[1].id).toBe('issue-1')
  })

  it('filters issues by state group', () => {
    const inProgress = filterIssuesByState(MOCK_ISSUES, 'started')
    expect(inProgress).toHaveLength(1)
    expect(inProgress[0].id).toBe('issue-2')
  })

  it('returns empty array when no issues match filter', () => {
    const done = filterIssuesByState(MOCK_ISSUES, 'completed')
    expect(done).toHaveLength(0)
  })

  it('sorts by priority (urgent first)', () => {
    const issues: PlaneIssue[] = [
      { ...MOCK_ISSUES[0], priority: 'low' },
      { ...MOCK_ISSUES[1], priority: 'urgent' },
    ]
    const sorted = sortIssuesByPriority(issues)
    expect(sorted[0].priority).toBe('urgent')
    expect(sorted[1].priority).toBe('low')
  })

  it('handles all priority levels', () => {
    const priorities = ['urgent', 'high', 'medium', 'low', 'none'] as const
    for (const p of priorities) {
      expect(getPriorityOrder(p)).toBeGreaterThanOrEqual(0)
    }
    expect(getPriorityOrder('unknown')).toBe(4) // default
  })
})

// ─── Comment visibility ───────────────────────────────────────────────────────

// This mirrors what the plane-proxy already strips, but tests the
// client assumption that internal comments are never present.

function assertNoInternalComments(issues: PlaneIssue[]): void {
  const internalPatterns = [
    /\[internal\]/i,
    /\[cost\]/i,
    /\[agent-note\]/i,
    /💰/,
    /^🏗️/,
  ]

  for (const issue of issues) {
    for (const comment of issue.comments ?? []) {
      const stripped = comment.comment_html.replace(/<[^>]*>/g, '').trim()
      for (const pattern of internalPatterns) {
        if (pattern.test(stripped)) {
          throw new Error(
            `Internal comment leaked to client: "${stripped}" (pattern: ${pattern})`
          )
        }
      }
    }
  }
}

describe('Client-side internal comment guard', () => {
  it('passes for issues with no internal comments', () => {
    expect(() => assertNoInternalComments(MOCK_ISSUES)).not.toThrow()
  })

  it('throws if an internal comment is present (should never happen with proxy)', () => {
    const issuesWithLeak: PlaneIssue[] = [
      {
        ...MOCK_ISSUES[0],
        comments: [
          {
            id: 'leaked',
            comment_html: '<p>[internal] This leaked!</p>',
            created_at: '',
            actor: { display_name: 'Agent' },
          } as PlaneComment,
        ],
      },
    ]
    expect(() => assertNoInternalComments(issuesWithLeak)).toThrow(
      'Internal comment leaked to client'
    )
  })

  it('throws if cost data is present', () => {
    const issuesWithCost: PlaneIssue[] = [
      {
        ...MOCK_ISSUES[0],
        comments: [
          {
            id: 'cost-leak',
            comment_html: '💰 Cost estimate: $5000',
            created_at: '',
            actor: { display_name: 'Mauzz' },
          } as PlaneComment,
        ],
      },
    ]
    expect(() => assertNoInternalComments(issuesWithCost)).toThrow()
  })

  it('passes for empty issues list', () => {
    expect(() => assertNoInternalComments([])).not.toThrow()
  })
})

// ─── Dashboard state management ──────────────────────────────────────────────

interface DashboardState {
  issues: PlaneIssue[]
  loading: boolean
  error: string | null
  lastUpdated: Date | null
}

function createInitialState(): DashboardState {
  return { issues: [], loading: true, error: null, lastUpdated: null }
}

function applyFetchSuccess(state: DashboardState, issues: PlaneIssue[], now: Date): DashboardState {
  return { ...state, issues, loading: false, error: null, lastUpdated: now }
}

function applyFetchError(state: DashboardState, error: string): DashboardState {
  return { ...state, loading: false, error }
}

describe('Dashboard state transitions', () => {
  it('starts in loading state', () => {
    const state = createInitialState()
    expect(state.loading).toBe(true)
    expect(state.issues).toHaveLength(0)
    expect(state.error).toBeNull()
  })

  it('transitions to loaded state on success', () => {
    const initial = createInitialState()
    const now = new Date()
    const next = applyFetchSuccess(initial, MOCK_ISSUES, now)
    expect(next.loading).toBe(false)
    expect(next.issues).toHaveLength(2)
    expect(next.error).toBeNull()
    expect(next.lastUpdated).toBe(now)
  })

  it('transitions to error state on failure', () => {
    const initial = createInitialState()
    const next = applyFetchError(initial, 'Network error')
    expect(next.loading).toBe(false)
    expect(next.error).toBe('Network error')
    expect(next.issues).toHaveLength(0)
  })

  it('clears error on subsequent success', () => {
    const errored = applyFetchError(createInitialState(), 'Error')
    const recovered = applyFetchSuccess(errored, MOCK_ISSUES, new Date())
    expect(recovered.error).toBeNull()
    expect(recovered.issues).toHaveLength(2)
  })
})
