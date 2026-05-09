'use client'

import { useState } from 'react'
import { createBrowserClient } from '@/lib/supabase'

interface IntakeFormProps {
  templateSlug: string
  templateName: string
  onComplete?: (result: IntakeResult) => void
}

interface IntakeResult {
  summary: string
  estimatedScope: string
  suggestedTemplate: string
  planeProjectId?: string
}

type FormStep = 'contact' | 'requirements' | 'context' | 'review' | 'processing' | 'done'

const FORM_STEPS: FormStep[] = ['contact', 'requirements', 'context', 'review']

const STEP_LABELS: Record<FormStep, string> = {
  contact: 'Contact Info',
  requirements: 'Requirements',
  context: 'Context',
  review: 'Review',
  processing: 'Processing',
  done: 'Complete',
}

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

const INITIAL_FORM_DATA: FormData = {
  name: '',
  email: '',
  company: '',
  projectDescription: '',
  timeline: '',
  budget: '',
  existingStack: '',
  primaryGoal: '',
  successMetric: '',
}

function StepIndicator({ current, steps }: { current: FormStep; steps: FormStep[] }) {
  const currentIdx = steps.indexOf(current)
  return (
    <div className="flex items-center gap-2 mb-8">
      {steps.map((step, idx) => (
        <div key={step} className="flex items-center gap-2">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
              idx < currentIdx
                ? 'bg-indigo-600 text-white'
                : idx === currentIdx
                ? 'bg-indigo-500 text-white ring-2 ring-indigo-400/30'
                : 'bg-[#2a2a2a] text-[#666666]'
            }`}
          >
            {idx < currentIdx ? '✓' : idx + 1}
          </div>
          <span
            className={`text-xs hidden sm:inline ${
              idx === currentIdx ? 'text-white' : 'text-[#666666]'
            }`}
          >
            {STEP_LABELS[step]}
          </span>
          {idx < steps.length - 1 && (
            <div
              className={`h-px w-8 ${idx < currentIdx ? 'bg-indigo-500' : 'bg-[#2a2a2a]'}`}
            />
          )}
        </div>
      ))}
    </div>
  )
}

function InputField({
  label,
  name,
  type = 'text',
  value,
  onChange,
  required,
  placeholder,
}: {
  label: string
  name: keyof FormData
  type?: string
  value: string
  onChange: (name: keyof FormData, value: string) => void
  required?: boolean
  placeholder?: string
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-[#aaaaaa] mb-1.5">
        {label} {required && <span className="text-indigo-400">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(name, e.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-4 py-2.5 text-sm text-white placeholder-[#555555] focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all"
      />
    </div>
  )
}

function TextareaField({
  label,
  name,
  value,
  onChange,
  required,
  placeholder,
  rows = 3,
}: {
  label: string
  name: keyof FormData
  value: string
  onChange: (name: keyof FormData, value: string) => void
  required?: boolean
  placeholder?: string
  rows?: number
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-[#aaaaaa] mb-1.5">
        {label} {required && <span className="text-indigo-400">*</span>}
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(name, e.target.value)}
        placeholder={placeholder}
        required={required}
        rows={rows}
        className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-4 py-2.5 text-sm text-white placeholder-[#555555] focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all resize-none"
      />
    </div>
  )
}

export function IntakeForm({ templateSlug, templateName, onComplete }: IntakeFormProps) {
  const [step, setStep] = useState<FormStep>('contact')
  const [formData, setFormData] = useState<FormData>(INITIAL_FORM_DATA)
  const [result, setResult] = useState<IntakeResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleChange = (name: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleNext = () => {
    const idx = FORM_STEPS.indexOf(step as FormStep)
    if (idx < FORM_STEPS.length - 1) {
      setStep(FORM_STEPS[idx + 1])
    }
  }

  const handleBack = () => {
    const idx = FORM_STEPS.indexOf(step as FormStep)
    if (idx > 0) setStep(FORM_STEPS[idx - 1])
  }

  const handleSubmit = async () => {
    setStep('processing')
    setError(null)

    try {
      const supabase = createBrowserClient()
      const { data: { session } } = await supabase.auth.getSession()

      const edgeFnBase = process.env.NEXT_PUBLIC_SUPABASE_URL
      const token = session?.access_token

      if (!edgeFnBase || !token) {
        throw new Error('Not authenticated — please sign in first.')
      }

      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      }

      // 1. AI intake
      const intakeRes = await fetch(`${edgeFnBase}/functions/v1/intake-ai`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          type: 'template_intake',
          payload: {
            formAnswers: {
              'Project description': formData.projectDescription,
              'Primary goal': formData.primaryGoal,
              'Success metric': formData.successMetric,
              'Timeline': formData.timeline,
              'Budget range': formData.budget,
              'Existing tech stack': formData.existingStack,
            },
            templateSlug,
            customerEmail: formData.email,
          },
        }),
      })

      if (!intakeRes.ok) throw new Error('AI intake failed')
      const { data: aiResult } = await intakeRes.json() as { data: IntakeResult }

      // 2. Create project
      const createRes = await fetch(`${edgeFnBase}/functions/v1/create-project`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          projectName: `${formData.company || formData.name} — ${templateName}`,
          templateSlug,
          intakeSummary: aiResult.summary,
        }),
      })

      if (!createRes.ok) throw new Error('Project creation failed')
      const { data: projectData } = await createRes.json() as {
        data: { planeProjectId: string; planeProjectSlug: string; message: string }
      }

      const finalResult: IntakeResult = {
        ...aiResult,
        planeProjectId: projectData.planeProjectId,
      }

      setResult(finalResult)
      setStep('done')
      onComplete?.(finalResult)
    } catch (err) {
      setError(String(err))
      setStep('review')
    }
  }

  if (step === 'processing') {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-[#888888] text-sm">Processing your intake with AI…</p>
      </div>
    )
  }

  if (step === 'done' && result) {
    return (
      <div className="space-y-6">
        <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center">
              <span className="text-white text-sm">✓</span>
            </div>
            <h3 className="text-lg font-semibold text-white">Project Created!</h3>
          </div>
          <p className="text-sm text-[#aaaaaa] mb-4">{result.summary}</p>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-[#666666]">Estimated scope</span>
              <p className="text-white font-medium">{result.estimatedScope}</p>
            </div>
            <div>
              <span className="text-[#666666]">Template matched</span>
              <p className="text-white font-medium">{result.suggestedTemplate}</p>
            </div>
          </div>
        </div>
        <p className="text-sm text-[#888888]">
          We&apos;ll be in touch within 1 business day. Check your dashboard for updates.
        </p>
        <a
          href="/dashboard"
          className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg px-6 py-2.5 text-sm font-medium transition-colors"
        >
          View Dashboard →
        </a>
      </div>
    )
  }

  return (
    <div>
      <StepIndicator current={step} steps={FORM_STEPS} />

      {error && (
        <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="space-y-4">
        {step === 'contact' && (
          <>
            <h2 className="text-xl font-semibold text-white mb-4">Contact Information</h2>
            <InputField label="Full Name" name="name" value={formData.name} onChange={handleChange} required placeholder="Jane Smith" />
            <InputField label="Email" name="email" type="email" value={formData.email} onChange={handleChange} required placeholder="jane@company.com" />
            <InputField label="Company" name="company" value={formData.company} onChange={handleChange} placeholder="Acme Corp" />
          </>
        )}

        {step === 'requirements' && (
          <>
            <h2 className="text-xl font-semibold text-white mb-4">Project Requirements</h2>
            <TextareaField
              label="Project Description"
              name="projectDescription"
              value={formData.projectDescription}
              onChange={handleChange}
              required
              placeholder="Describe what you want to build…"
              rows={4}
            />
            <InputField label="Primary Goal" name="primaryGoal" value={formData.primaryGoal} onChange={handleChange} required placeholder="e.g., Reduce client onboarding time by 50%" />
            <InputField label="Success Metric" name="successMetric" value={formData.successMetric} onChange={handleChange} placeholder="e.g., < 10 min average intake time" />
          </>
        )}

        {step === 'context' && (
          <>
            <h2 className="text-xl font-semibold text-white mb-4">Project Context</h2>
            <InputField label="Timeline" name="timeline" value={formData.timeline} onChange={handleChange} placeholder="e.g., Launch by Q3 2026" />
            <InputField label="Budget Range" name="budget" value={formData.budget} onChange={handleChange} placeholder="e.g., $5k–$15k" />
            <TextareaField
              label="Existing Tech Stack"
              name="existingStack"
              value={formData.existingStack}
              onChange={handleChange}
              placeholder="Any existing systems, APIs, or databases we need to integrate with…"
              rows={3}
            />
          </>
        )}

        {step === 'review' && (
          <>
            <h2 className="text-xl font-semibold text-white mb-4">Review Your Intake</h2>
            <div className="space-y-3 text-sm">
              {Object.entries(formData)
                .filter(([, v]) => v)
                .map(([k, v]) => (
                  <div key={k} className="flex gap-3 py-2 border-b border-[#1f1f1f]">
                    <span className="text-[#666666] capitalize w-36 flex-shrink-0">
                      {k.replace(/([A-Z])/g, ' $1').trim()}
                    </span>
                    <span className="text-white">{v}</span>
                  </div>
                ))}
            </div>
          </>
        )}
      </div>

      <div className="flex gap-3 mt-8">
        {FORM_STEPS.indexOf(step as FormStep) > 0 && (
          <button
            onClick={handleBack}
            className="flex-1 bg-[#1f1f1f] hover:bg-[#2a2a2a] text-white rounded-lg px-6 py-2.5 text-sm font-medium transition-colors"
          >
            ← Back
          </button>
        )}
        {step !== 'review' ? (
          <button
            onClick={handleNext}
            className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg px-6 py-2.5 text-sm font-medium transition-colors"
          >
            Next →
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg px-6 py-2.5 text-sm font-medium transition-colors"
          >
            Submit Intake
          </button>
        )}
      </div>
    </div>
  )
}

export default IntakeForm
