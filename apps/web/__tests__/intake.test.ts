/**
 * intake.test.ts
 * Tests IntakeForm validation logic and AI call mocking.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ─── Form validation logic ────────────────────────────────────────────────────

interface FormData {
  name: string
  email: string
  company: string
  projectDescription: string
  timeline: string
  budget: string
  existingStack: string
  primaryGoal: string
  successMetric: string
}

function validateContactStep(data: Pick<FormData, 'name' | 'email'>): string[] {
  const errors: string[] = []
  if (!data.name.trim()) errors.push('Name is required')
  if (!data.email.trim()) errors.push('Email is required')
  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    errors.push('Email must be valid')
  }
  return errors
}

function validateRequirementsStep(
  data: Pick<FormData, 'projectDescription' | 'primaryGoal'>
): string[] {
  const errors: string[] = []
  if (!data.projectDescription.trim()) errors.push('Project description is required')
  if (!data.primaryGoal.trim()) errors.push('Primary goal is required')
  return errors
}

function canProceedToReview(data: FormData): boolean {
  return (
    validateContactStep(data).length === 0 &&
    validateRequirementsStep(data).length === 0
  )
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Contact step validation', () => {
  it('passes with valid name and email', () => {
    const errors = validateContactStep({ name: 'Jane Smith', email: 'jane@example.com' })
    expect(errors).toHaveLength(0)
  })

  it('requires name', () => {
    const errors = validateContactStep({ name: '', email: 'jane@example.com' })
    expect(errors).toContain('Name is required')
  })

  it('requires email', () => {
    const errors = validateContactStep({ name: 'Jane', email: '' })
    expect(errors).toContain('Email is required')
  })

  it('validates email format', () => {
    const errors = validateContactStep({ name: 'Jane', email: 'not-an-email' })
    expect(errors).toContain('Email must be valid')
  })

  it('accepts emails with subdomains', () => {
    const errors = validateContactStep({ name: 'Jane', email: 'jane@sub.example.com' })
    expect(errors).toHaveLength(0)
  })

  it('reports multiple errors', () => {
    const errors = validateContactStep({ name: '', email: 'bad' })
    expect(errors.length).toBeGreaterThan(1)
  })
})

describe('Requirements step validation', () => {
  it('passes with description and goal', () => {
    const errors = validateRequirementsStep({
      projectDescription: 'Build a portal',
      primaryGoal: 'Reduce onboarding time',
    })
    expect(errors).toHaveLength(0)
  })

  it('requires project description', () => {
    const errors = validateRequirementsStep({
      projectDescription: '',
      primaryGoal: 'Reduce onboarding time',
    })
    expect(errors).toContain('Project description is required')
  })

  it('requires primary goal', () => {
    const errors = validateRequirementsStep({
      projectDescription: 'Build a portal',
      primaryGoal: '',
    })
    expect(errors).toContain('Primary goal is required')
  })

  it('treats whitespace-only as empty', () => {
    const errors = validateRequirementsStep({
      projectDescription: '   ',
      primaryGoal: '   ',
    })
    expect(errors).toHaveLength(2)
  })
})

describe('canProceedToReview', () => {
  const validData: FormData = {
    name: 'Jane Smith',
    email: 'jane@example.com',
    company: 'Acme',
    projectDescription: 'Build an intake portal',
    timeline: 'Q3 2026',
    budget: '$10k',
    existingStack: 'React, Node',
    primaryGoal: 'Reduce onboarding by 50%',
    successMetric: 'Under 10 min average',
  }

  it('returns true when all required fields valid', () => {
    expect(canProceedToReview(validData)).toBe(true)
  })

  it('returns false if name missing', () => {
    expect(canProceedToReview({ ...validData, name: '' })).toBe(false)
  })

  it('returns false if email invalid', () => {
    expect(canProceedToReview({ ...validData, email: 'not-email' })).toBe(false)
  })

  it('returns false if project description missing', () => {
    expect(canProceedToReview({ ...validData, projectDescription: '' })).toBe(false)
  })

  it('allows optional fields to be empty', () => {
    expect(
      canProceedToReview({ ...validData, company: '', budget: '', existingStack: '' })
    ).toBe(true)
  })
})

// ─── AI intake call mocking ───────────────────────────────────────────────────

interface IntakeAIRequest {
  type: 'template_intake' | 'session_summary'
  payload: Record<string, unknown>
}

interface IntakeAIResponse {
  data: {
    summary: string
    estimatedScope: string
    suggestedTemplate: string
  }
}

async function callIntakeAI(
  request: IntakeAIRequest,
  accessToken: string,
  baseUrl: string
): Promise<IntakeAIResponse['data']> {
  const res = await fetch(`${baseUrl}/functions/v1/intake-ai`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(request),
  })
  if (!res.ok) throw new Error(`intake-ai failed: ${res.status}`)
  const json = (await res.json()) as IntakeAIResponse
  return json.data
}

describe('AI intake call (mocked fetch)', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('calls intake-ai endpoint with correct structure', async () => {
    const mockFetch = vi.mocked(fetch)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          summary: 'Client wants an onboarding portal.',
          estimatedScope: '4 weeks, 1 developer',
          suggestedTemplate: 'ai-intake',
        },
      }),
    } as Response)

    const result = await callIntakeAI(
      {
        type: 'template_intake',
        payload: {
          formAnswers: { 'Project description': 'Build intake portal' },
          templateSlug: 'ai-intake',
        },
      },
      'mock-token',
      'https://example.supabase.co'
    )

    expect(mockFetch).toHaveBeenCalledWith(
      'https://example.supabase.co/functions/v1/intake-ai',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer mock-token',
        }),
      })
    )

    expect(result.summary).toBe('Client wants an onboarding portal.')
    expect(result.estimatedScope).toBe('4 weeks, 1 developer')
    expect(result.suggestedTemplate).toBe('ai-intake')
  })

  it('throws on non-OK response', async () => {
    const mockFetch = vi.mocked(fetch)
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Internal error' }),
    } as Response)

    await expect(
      callIntakeAI(
        { type: 'template_intake', payload: {} },
        'token',
        'https://example.supabase.co'
      )
    ).rejects.toThrow('intake-ai failed: 500')
  })

  it('handles session_summary type correctly', async () => {
    const mockFetch = vi.mocked(fetch)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          summary: 'Session covered auth and data model.',
          estimatedScope: 'N/A',
          suggestedTemplate: 'ai-intake',
        },
      }),
    } as Response)

    const result = await callIntakeAI(
      {
        type: 'session_summary',
        payload: { notes: 'Discussed auth flow', sessionId: 'sess-1' },
      },
      'token',
      'https://example.supabase.co'
    )

    const call = mockFetch.mock.calls[0]
    const body = JSON.parse(call[1]?.body as string) as IntakeAIRequest
    expect(body.type).toBe('session_summary')
    expect(result.summary).toBe('Session covered auth and data model.')
  })
})

// ─── Template slug validation ─────────────────────────────────────────────────

const VALID_TEMPLATE_SLUGS = ['ai-intake', 'quote-engine', 'reporting-console'] as const
type ValidSlug = (typeof VALID_TEMPLATE_SLUGS)[number]

function isValidTemplateSlug(slug: string): slug is ValidSlug {
  return VALID_TEMPLATE_SLUGS.includes(slug as ValidSlug)
}

describe('Template slug validation', () => {
  it('accepts valid slugs', () => {
    expect(isValidTemplateSlug('ai-intake')).toBe(true)
    expect(isValidTemplateSlug('quote-engine')).toBe(true)
    expect(isValidTemplateSlug('reporting-console')).toBe(true)
  })

  it('rejects invalid slugs', () => {
    expect(isValidTemplateSlug('unknown-template')).toBe(false)
    expect(isValidTemplateSlug('')).toBe(false)
    expect(isValidTemplateSlug('ai_intake')).toBe(false) // wrong separator
  })
})
