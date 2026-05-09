import { notFound } from 'next/navigation'
import Link from 'next/link'
import { IntakeForm } from '@/components/IntakeForm'
import { TEMPLATE_CATALOG, enrichTemplate, getComplexityLabel, getComplexityColor } from '@/lib/templates'
import type { Database } from '@/lib/supabase'

type Template = Database['public']['Tables']['templates']['Row']

const STATIC_TEMPLATES: Record<string, Template> = {
  'ai-intake': {
    id: '1',
    slug: 'ai-intake',
    name: 'AI-Powered Client Onboarding',
    description:
      'Intelligent intake portal that uses AI to qualify leads, generate project briefs, and automatically provision your Plane workspace. Reduces onboarding time from days to minutes.',
    complexity: 'medium',
    active: true,
    sort_order: 1,
  },
  'quote-engine': {
    id: '2',
    slug: 'quote-engine',
    name: 'Dynamic Quote & Proposal Engine',
    description:
      'Configurable pricing engine with dynamic proposal generation. Supports line items, discounts, approval workflows, and PDF export. Fastest path from prospect to signed contract.',
    complexity: 'low',
    active: true,
    sort_order: 2,
  },
  'reporting-console': {
    id: '3',
    slug: 'reporting-console',
    name: 'Automated Reporting & BI Console',
    description:
      'Real-time reporting dashboard with automated scheduling, multi-source data connectors, and role-based access. Turn your operational data into actionable client insights.',
    complexity: 'high',
    active: true,
    sort_order: 3,
  },
}

interface PageProps {
  params: Promise<{ slug: string }>
}

export async function generateStaticParams() {
  return Object.keys(TEMPLATE_CATALOG).map((slug) => ({ slug }))
}

export default async function TemplateDetailPage({ params }: PageProps) {
  const { slug } = await params
  const template = STATIC_TEMPLATES[slug]

  if (!template) notFound()

  const enriched = enrichTemplate(template)
  const complexityColor = getComplexityColor(template.complexity)

  return (
    <main className="min-h-screen">
      {/* Nav */}
      <nav className="border-b border-[#1f1f1f] px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center gap-4">
          <Link href="/templates" className="text-sm text-[#666666] hover:text-white transition-colors">
            ← Templates
          </Link>
          <span className="text-[#333333]">/</span>
          <span className="text-sm text-white">{template.name}</span>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Left: template info */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div
                className="w-14 h-14 rounded-xl flex items-center justify-center text-3xl"
                style={{ backgroundColor: `${enriched.color}20` }}
              >
                {enriched.icon}
              </div>
              <div>
                <span
                  className="text-xs font-medium px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: `${complexityColor}20`, color: complexityColor }}
                >
                  {getComplexityLabel(template.complexity)}
                </span>
                <span className="text-xs text-[#555555] ml-2">
                  ⏱ {enriched.estimatedTimeline}
                </span>
              </div>
            </div>

            <h1 className="text-3xl font-bold text-white mb-3">{template.name}</h1>
            <p className="text-[#888888] leading-relaxed mb-8">{template.description}</p>

            {/* Features */}
            <div className="mb-8">
              <h3 className="text-sm font-semibold text-[#aaaaaa] uppercase tracking-wider mb-3">
                Features
              </h3>
              <ul className="space-y-2">
                {enriched.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-[#cccccc]">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>

            {/* Deliverables */}
            <div className="mb-8">
              <h3 className="text-sm font-semibold text-[#aaaaaa] uppercase tracking-wider mb-3">
                Deliverables
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {enriched.deliverables.map((d) => (
                  <div
                    key={d}
                    className="bg-[#111111] border border-[#2a2a2a] rounded-lg px-3 py-2 text-xs text-[#aaaaaa]"
                  >
                    {d}
                  </div>
                ))}
              </div>
            </div>

            {/* Use cases */}
            <div>
              <h3 className="text-sm font-semibold text-[#aaaaaa] uppercase tracking-wider mb-3">
                Best for
              </h3>
              <div className="flex flex-wrap gap-2">
                {enriched.useCases.map((u) => (
                  <span
                    key={u}
                    className="text-xs px-3 py-1.5 rounded-full bg-[#1f1f1f] border border-[#2a2a2a] text-[#888888]"
                  >
                    {u}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Right: intake form */}
          <div>
            <div className="bg-[#111111] border border-[#2a2a2a] rounded-xl p-8">
              <h2 className="text-xl font-semibold text-white mb-1">Start Your Intake</h2>
              <p className="text-sm text-[#666666] mb-6">
                Takes 3 minutes · AI-assisted · Free
              </p>
              <IntakeForm
                templateSlug={template.slug}
                templateName={template.name}
              />
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
