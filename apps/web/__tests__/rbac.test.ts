/**
 * rbac.test.ts
 * Tests the plane-proxy RBAC filtering logic.
 * We extract and unit-test the filter functions directly.
 */

import { describe, it, expect } from 'vitest'

// ─── Inline the filter logic (mirrors supabase/functions/plane-proxy/index.ts) ───

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

function validateEndpoint(endpoint: string, planeProjectId: string): boolean {
  const expectedPrefix = `/workspaces/hyperforge/projects/${planeProjectId}/`
  return endpoint.startsWith(expectedPrefix)
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('RBAC filter: isInternalComment', () => {
  it('detects [internal] tag (case-insensitive)', () => {
    expect(isInternalComment('<p>[internal] This is private</p>')).toBe(true)
    expect(isInternalComment('<p>[INTERNAL] Budget discussion</p>')).toBe(true)
  })

  it('detects [cost] tag', () => {
    expect(isInternalComment('[cost] $5000 estimate')).toBe(true)
  })

  it('detects [agent-note] tag', () => {
    expect(isInternalComment('<p>[agent-note] Mauzz review needed</p>')).toBe(true)
  })

  it('detects 💰 emoji', () => {
    expect(isInternalComment('💰 Cost estimate: $3,000')).toBe(true)
    expect(isInternalComment('<p>💰 $2500 for this sprint</p>')).toBe(true)
  })

  it('detects 🏗️ prefix (Mauzz internal)', () => {
    expect(isInternalComment('🏗️ Mauzz — Phase Complete')).toBe(true)
    expect(isInternalComment('🏗️ Internal build note')).toBe(true)
  })

  it('passes through customer-visible comments', () => {
    expect(isInternalComment('Your project is on track!')).toBe(false)
    expect(isInternalComment('<p>We completed the authentication module.</p>')).toBe(false)
    expect(isInternalComment('Update: login flow is ready for review.')).toBe(false)
  })

  it('handles empty comment', () => {
    expect(isInternalComment('')).toBe(false)
  })
})

describe('RBAC filter: filterIssue', () => {
  it('strips cost_estimate field', () => {
    const issue: PlaneIssue = {
      id: 'issue-1',
      name: 'Build login',
      cost_estimate: 5000,
      state: { name: 'In Progress' },
    }
    const filtered = filterIssue(issue)
    expect(filtered.cost_estimate).toBeUndefined()
    expect(filtered.name).toBe('Build login')
  })

  it('strips internal_notes field', () => {
    const issue: PlaneIssue = {
      id: 'issue-2',
      name: 'Build API',
      internal_notes: 'Use new auth pattern',
    }
    const filtered = filterIssue(issue)
    expect(filtered.internal_notes).toBeUndefined()
  })

  it('strips agent_notes field', () => {
    const issue: PlaneIssue = {
      id: 'issue-3',
      name: 'Deploy service',
      agent_notes: 'Assigned to Forge',
    }
    const filtered = filterIssue(issue)
    expect(filtered.agent_notes).toBeUndefined()
  })

  it('removes internal comments from comments array', () => {
    const issue: PlaneIssue = {
      id: 'issue-4',
      name: 'Feature X',
      comments: [
        { id: 'c1', comment_html: '<p>Your feature is in progress!</p>' },
        { id: 'c2', comment_html: '<p>[internal] This needs refactoring</p>' },
        { id: 'c3', comment_html: '💰 Cost: $2000' },
        { id: 'c4', comment_html: 'We expect delivery by Friday.' },
      ],
    }
    const filtered = filterIssue(issue)
    expect(filtered.comments).toHaveLength(2)
    expect(filtered.comments![0].id).toBe('c1')
    expect(filtered.comments![1].id).toBe('c4')
  })

  it('preserves all other fields', () => {
    const issue: PlaneIssue = {
      id: 'issue-5',
      name: 'Test issue',
      sequence_id: 42,
      priority: 'high',
      state: { name: 'Done', color: '#10b981' },
    }
    const filtered = filterIssue(issue)
    expect(filtered.id).toBe('issue-5')
    expect(filtered.sequence_id).toBe(42)
    expect(filtered.priority).toBe('high')
    expect(filtered.state).toEqual({ name: 'Done', color: '#10b981' })
  })

  it('handles issue with no comments', () => {
    const issue: PlaneIssue = { id: 'issue-6', name: 'No comments' }
    const filtered = filterIssue(issue)
    expect(filtered.comments).toBeUndefined()
  })
})

describe('RBAC filter: filterResponse', () => {
  it('filters an array of issues', () => {
    const issues: PlaneIssue[] = [
      { id: '1', cost_estimate: 100, name: 'Issue 1' },
      { id: '2', internal_notes: 'private', name: 'Issue 2' },
    ]
    const filtered = filterResponse(issues) as PlaneIssue[]
    expect(filtered[0].cost_estimate).toBeUndefined()
    expect(filtered[1].internal_notes).toBeUndefined()
  })

  it('filters paginated response shape { results: [...] }', () => {
    const paged = {
      count: 2,
      results: [
        { id: '1', cost_estimate: 999, name: 'A' },
        { id: '2', name: 'B' },
      ],
    }
    const filtered = filterResponse(paged) as { count: number; results: PlaneIssue[] }
    expect(filtered.count).toBe(2)
    expect(filtered.results[0].cost_estimate).toBeUndefined()
    expect(filtered.results[0].name).toBe('A')
  })

  it('filters a single issue object', () => {
    const single: PlaneIssue = {
      id: 'single',
      cost_estimate: 5000,
      name: 'Single issue',
    }
    const filtered = filterResponse(single) as PlaneIssue
    expect(filtered.cost_estimate).toBeUndefined()
    expect(filtered.name).toBe('Single issue')
  })

  it('passes through non-object values', () => {
    expect(filterResponse(null)).toBeNull()
    expect(filterResponse(42)).toBe(42)
    expect(filterResponse('hello')).toBe('hello')
  })
})

describe('Endpoint validation', () => {
  const projectId = 'proj-abc-123'

  it('allows endpoints scoped to the customer project', () => {
    expect(
      validateEndpoint(
        `/workspaces/hyperforge/projects/${projectId}/issues/`,
        projectId
      )
    ).toBe(true)
    expect(
      validateEndpoint(
        `/workspaces/hyperforge/projects/${projectId}/issues/issue-id/comments/`,
        projectId
      )
    ).toBe(true)
  })

  it('rejects endpoints scoped to a different project', () => {
    expect(
      validateEndpoint(
        '/workspaces/hyperforge/projects/other-project/issues/',
        projectId
      )
    ).toBe(false)
  })

  it('rejects workspace-level endpoints', () => {
    expect(
      validateEndpoint('/workspaces/hyperforge/projects/', projectId)
    ).toBe(false)
  })

  it('rejects completely different paths', () => {
    expect(validateEndpoint('/admin/users/', projectId)).toBe(false)
    expect(validateEndpoint('', projectId)).toBe(false)
  })
})
