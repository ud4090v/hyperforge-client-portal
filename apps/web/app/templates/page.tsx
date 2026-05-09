import { createServerClient } from '@/lib/supabase'
import { cookies } from 'next/headers'
import { TemplateBrowser } from '@/components/TemplateBrowser'
import { enrichTemplate } from '@/lib/templates'
import type { Database } from '@/lib/supabase'
import Link from 'next/link'

type Template = Database['public']['Tables']['templates']['Row']

// Fallback static data if DB is unavailable (e.g., local dev without Supabase)
const STATIC_TEMPLATES: Template[] = [
  {
    id: '1',
    slug: 'ai-intake',
    name: 'AI-Powered Client Onboarding',
    description:
      'Intelligent intake portal that uses AI to qualify leads, generate project briefs, and automatically provision your Plane workspace.',
    complexity: 'medium',
    active: true,
    sort_order: 1,
  },
  {
    id: '2',
    slug: 'quote-engine',
    name: 'Dynamic Quote & Proposal Engine',
    description:
      'Configurable pricing engine with dynamic proposal generation. Supports line items, discounts, approval workflows, and PDF export.',
    complexity: 'low',
    active: true,
    sort_order: 2,
  },
  {
    id: '3',
    slug: 'reporting-console',
    name: 'Automated Reporting & BI Console',
    description:
      'Real-time reporting dashboard with automated scheduling, multi-source data connectors, and role-based access.',
    complexity: 'high',
    active: true,
    sort_order: 3,
  },
]

async function getTemplates(): Promise<Template[]> {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(cookieStore)
    const { data, error } = await supabase
      .from('templates')
      .select('*')
      .eq('active', true)
      .order('sort_order')
    if (error || !data?.length) return STATIC_TEMPLATES
    return data
  } catch {
    return STATIC_TEMPLATES
  }
}

export default async function TemplatesPage() {
  const templates = await getTemplates()
  const enriched = templates.map(enrichTemplate)

  return (
    <main className="min-h-screen">
      {/* Nav */}
      <nav className="border-b border-[#1f1f1f] px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center gap-4">
          <Link href="/" className="text-sm text-[#666666] hover:text-white transition-colors">
            ← Home
          </Link>
          <span className="text-[#333333]">/</span>
          <span className="text-sm text-white">Templates</span>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-12">
        <TemplateBrowser templates={enriched} />
      </div>
    </main>
  )
}
