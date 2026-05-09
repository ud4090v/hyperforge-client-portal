import Link from 'next/link'
import { TemplateBrowser } from '@/components/TemplateBrowser'
import { enrichTemplate } from '@/lib/templates'
import type { Database } from '@/lib/supabase'

type Template = Database['public']['Tables']['templates']['Row']

// Static template data (matches DB seed — used for SSG-friendly landing page)
const LANDING_TEMPLATES: Template[] = [
  {
    id: '1',
    slug: 'ai-intake',
    name: 'AI-Powered Client Onboarding',
    description:
      'Intelligent intake portal that uses AI to qualify leads, generate project briefs, and automatically provision your Plane workspace. Reduces onboarding time from days to minutes.',
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

export default function LandingPage() {
  const enriched = LANDING_TEMPLATES.map(enrichTemplate)

  return (
    <main className="min-h-screen">
      {/* Nav */}
      <nav className="border-b border-[#1f1f1f] px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold text-white">HyperForge</span>
            <span className="text-xs text-[#555555] border border-[#2a2a2a] rounded px-2 py-0.5">
              Client Portal
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/templates" className="text-sm text-[#888888] hover:text-white transition-colors">
              Templates
            </Link>
            <Link href="/consult" className="text-sm text-[#888888] hover:text-white transition-colors">
              Free Consult
            </Link>
            <Link
              href="/dashboard"
              className="text-sm bg-[#1f1f1f] border border-[#2a2a2a] hover:border-[#3a3a3a] text-white rounded-lg px-4 py-1.5 transition-colors"
            >
              Dashboard
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="px-6 py-24 text-center">
        <div className="max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-400 mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
            Engineering-grade software, delivered fast
          </div>
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-6 leading-tight">
            Ship your product idea
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">
              the right way
            </span>
          </h1>
          <p className="text-lg text-[#888888] mb-10 leading-relaxed">
            Select a pre-built template and get started in minutes, or book a free
            consultation to design a custom solution with our senior architects.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/templates"
              className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl px-8 py-3.5 font-semibold transition-colors text-sm"
            >
              Browse Templates
            </Link>
            <Link
              href="/consult"
              className="bg-[#1f1f1f] hover:bg-[#2a2a2a] border border-[#2a2a2a] hover:border-[#3a3a3a] text-white rounded-xl px-8 py-3.5 font-semibold transition-colors text-sm"
            >
              Book Free Consult →
            </Link>
          </div>
        </div>
      </section>

      {/* Template preview */}
      <section className="px-6 pb-24">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white mb-3">
              Production-ready templates
            </h2>
            <p className="text-[#888888]">
              Each template is a complete solution — schema, backend, UI, and integrations included.
            </p>
          </div>
          <TemplateBrowser templates={enriched} preview />
        </div>
      </section>

      {/* How it works */}
      <section className="px-6 py-24 border-t border-[#1f1f1f]">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-white text-center mb-12">How it works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                step: '1',
                title: 'Choose a template',
                desc: 'Browse our catalog and select the template closest to your needs.',
                icon: '🎯',
              },
              {
                step: '2',
                title: 'Submit your intake',
                desc: 'Answer a few questions. Our AI generates your project brief in seconds.',
                icon: '🤖',
              },
              {
                step: '3',
                title: 'Track your build',
                desc: "Watch your project progress in real-time via your dashboard.",
                icon: '📊',
              },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-3xl mx-auto mb-4">
                  {item.icon}
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">{item.title}</h3>
                <p className="text-sm text-[#888888] leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-24 border-t border-[#1f1f1f]">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Not sure where to start?
          </h2>
          <p className="text-[#888888] mb-8">
            Book a free 1-hour consultation with a HyperForge architect. We&apos;ll map out
            your requirements and recommend the best path forward — no commitment required.
          </p>
          <Link
            href="/consult"
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl px-8 py-3.5 font-semibold transition-colors"
          >
            Book Free Consult
            <span>→</span>
          </Link>
          <p className="text-xs text-[#555555] mt-4">
            1 hour • System-enforced timer • No sales pitch
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#1f1f1f] px-6 py-8">
        <div className="max-w-7xl mx-auto flex items-center justify-between text-xs text-[#555555]">
          <span>© 2026 HyperForge. All rights reserved.</span>
          <span>Built with HyperForge Platform</span>
        </div>
      </footer>
    </main>
  )
}
