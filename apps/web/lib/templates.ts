import type { Database } from './supabase'

export type Template = Database['public']['Tables']['templates']['Row']

export interface TemplateDetails extends Template {
  features: string[]
  useCases: string[]
  deliverables: string[]
  estimatedTimeline: string
  color: string
  icon: string
}

// Static catalog — mirrors the DB seed data, used for rich display
export const TEMPLATE_CATALOG: Record<string, Omit<TemplateDetails, keyof Template>> = {
  'ai-intake': {
    features: [
      'AI-powered form assistant',
      'Automatic project brief generation',
      'Smart template recommendations',
      'Instant timeline estimates',
    ],
    useCases: [
      'Client onboarding automation',
      'Lead qualification',
      'Service intake workflows',
    ],
    deliverables: [
      'Custom intake portal',
      'Automated brief generation',
      'Plane project integration',
      'Email notifications',
    ],
    estimatedTimeline: '2–4 weeks',
    color: '#6366f1',
    icon: '🤖',
  },
  'quote-engine': {
    features: [
      'Dynamic pricing calculator',
      'Proposal PDF generation',
      'Version history',
      'E-signature ready',
    ],
    useCases: [
      'Service businesses',
      'Freelancers & agencies',
      'Product configurators',
    ],
    deliverables: [
      'Quote builder UI',
      'PDF export engine',
      'Approval workflow',
      'CRM-ready API',
    ],
    estimatedTimeline: '1–3 weeks',
    color: '#10b981',
    icon: '💰',
  },
  'reporting-console': {
    features: [
      'Live data dashboards',
      'Automated report scheduling',
      'Multi-source data connectors',
      'Export to CSV/PDF',
    ],
    useCases: [
      'Operations reporting',
      'Client status dashboards',
      'KPI monitoring',
    ],
    deliverables: [
      'Realtime dashboard',
      'Scheduled report emails',
      'Data connectors',
      'Role-based access',
    ],
    estimatedTimeline: '3–5 weeks',
    color: '#f59e0b',
    icon: '📊',
  },
}

export function enrichTemplate(template: Template): TemplateDetails {
  const extra = TEMPLATE_CATALOG[template.slug] ?? {
    features: [],
    useCases: [],
    deliverables: [],
    estimatedTimeline: 'TBD',
    color: '#6366f1',
    icon: '🔧',
  }
  return { ...template, ...extra }
}

export function getComplexityLabel(complexity: string | null): string {
  switch (complexity) {
    case 'low':
      return 'Quick Win'
    case 'medium':
      return 'Standard Build'
    case 'high':
      return 'Enterprise'
    default:
      return 'Custom'
  }
}

export function getComplexityColor(complexity: string | null): string {
  switch (complexity) {
    case 'low':
      return '#10b981'
    case 'medium':
      return '#6366f1'
    case 'high':
      return '#f59e0b'
    default:
      return '#888888'
  }
}
