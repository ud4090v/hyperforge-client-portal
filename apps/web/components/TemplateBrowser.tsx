'use client'

import Link from 'next/link'
import { type TemplateDetails, getComplexityLabel, getComplexityColor } from '@/lib/templates'

interface TemplateBrowserProps {
  templates: TemplateDetails[]
  preview?: boolean // show 3-card preview mode on landing page
}

function ComplexityBadge({ complexity }: { complexity: string | null }) {
  const label = getComplexityLabel(complexity)
  const color = getComplexityColor(complexity)
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ backgroundColor: `${color}20`, color }}
    >
      {label}
    </span>
  )
}

function TemplateCard({ template }: { template: TemplateDetails }) {
  return (
    <div
      className="group relative flex flex-col bg-[#111111] border border-[#2a2a2a] rounded-xl p-6 hover:border-[#6366f1] transition-all duration-200 hover:shadow-lg hover:shadow-indigo-500/10"
      data-testid="template-card"
    >
      {/* Icon + badge row */}
      <div className="flex items-start justify-between mb-4">
        <div
          className="w-12 h-12 rounded-lg flex items-center justify-center text-2xl"
          style={{ backgroundColor: `${template.color}20` }}
        >
          {template.icon}
        </div>
        <ComplexityBadge complexity={template.complexity} />
      </div>

      {/* Name + description */}
      <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-indigo-400 transition-colors">
        {template.name}
      </h3>
      <p className="text-sm text-[#888888] leading-relaxed mb-4 flex-1">
        {template.description}
      </p>

      {/* Features */}
      <ul className="space-y-1 mb-4">
        {template.features.slice(0, 3).map((f) => (
          <li key={f} className="flex items-center gap-2 text-xs text-[#aaaaaa]">
            <span className="w-1 h-1 rounded-full bg-indigo-500 flex-shrink-0" />
            {f}
          </li>
        ))}
      </ul>

      {/* Timeline + CTA */}
      <div className="flex items-center justify-between mt-auto pt-4 border-t border-[#2a2a2a]">
        <span className="text-xs text-[#666666]">⏱ {template.estimatedTimeline}</span>
        <Link
          href={`/templates/${template.slug}`}
          className="text-sm font-medium text-indigo-400 hover:text-indigo-300 transition-colors"
        >
          Get started →
        </Link>
      </div>
    </div>
  )
}

export function TemplateBrowser({ templates, preview = false }: TemplateBrowserProps) {
  const displayTemplates = preview ? templates.slice(0, 3) : templates

  return (
    <section>
      {!preview && (
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Solution Templates</h1>
          <p className="text-[#888888]">
            Pre-built starters engineered by HyperForge. Select a template to begin your intake.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {displayTemplates.map((template) => (
          <TemplateCard key={template.slug} template={template} />
        ))}
      </div>

      {preview && (
        <div className="text-center mt-8">
          <Link
            href="/templates"
            className="inline-flex items-center gap-2 text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            View all templates →
          </Link>
        </div>
      )}
    </section>
  )
}

export default TemplateBrowser
