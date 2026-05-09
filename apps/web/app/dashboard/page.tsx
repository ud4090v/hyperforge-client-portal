'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createBrowserClient } from '@/lib/supabase'
import { ProjectDashboard } from '@/components/ProjectDashboard'

interface CustomerProject {
  id: string
  plane_project_id: string
  plane_project_slug: string | null
  template_slug: string | null
  created_at: string
}

interface Customer {
  id: string
  email: string
  name: string | null
  tier: string
}

export default function DashboardPage() {
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [project, setProject] = useState<CustomerProject | null>(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState(false)

  useEffect(() => {
    const load = async () => {
      const supabase = createBrowserClient()
      const { data: userData } = await supabase.auth.getUser()
      const user = userData?.user

      if (!user) {
        setAuthError(true)
        setLoading(false)
        return
      }

      // Get customer
      const { data: customerData } = await supabase
        .from('customers')
        .select('id, email, name, tier')
        .eq('auth_id', user.id)
        .single()

      if (!customerData) {
        setAuthError(true)
        setLoading(false)
        return
      }

      const c = customerData as Customer
      setCustomer(c)

      // Get their project
      const { data: projectData } = await supabase
        .from('customer_projects')
        .select('id, plane_project_id, plane_project_slug, template_slug, created_at')
        .eq('customer_id', c.id)
        .single()

      setProject(projectData as CustomerProject | null)
      setLoading(false)
    }

    void load()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (authError) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#1f1f1f] flex items-center justify-center text-3xl mx-auto mb-6">
            🔒
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">Sign in to view your dashboard</h2>
          <p className="text-[#888888] mb-6">
            Your project dashboard requires authentication. Use the magic link sent to your email.
          </p>
          <Link
            href="/consult"
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl px-6 py-2.5 text-sm font-medium transition-colors"
          >
            Book a consultation
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen">
      {/* Nav */}
      <nav className="border-b border-[#1f1f1f] px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-sm text-[#666666] hover:text-white transition-colors">
              HyperForge
            </Link>
            <span className="text-[#333333]">/</span>
            <span className="text-sm text-white">Dashboard</span>
          </div>
          {customer && (
            <div className="flex items-center gap-3">
              <span className="text-xs text-[#555555]">
                {customer.name ?? customer.email}
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 capitalize">
                {customer.tier}
              </span>
            </div>
          )}
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Page header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Your Project</h1>
          <p className="text-[#666666] text-sm">
            Real-time status of your HyperForge project. Updates every 30 seconds.
          </p>
        </div>

        {project ? (
          <div className="space-y-6">
            {/* Project meta */}
            <div className="bg-[#111111] border border-[#2a2a2a] rounded-xl p-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-[#555555] text-xs">Project ID</span>
                  <p className="text-white font-mono text-xs mt-1">
                    {project.plane_project_slug ?? project.plane_project_id.slice(0, 8)}
                  </p>
                </div>
                <div>
                  <span className="text-[#555555] text-xs">Template</span>
                  <p className="text-white mt-1 capitalize">
                    {project.template_slug?.replace(/-/g, ' ') ?? 'Custom'}
                  </p>
                </div>
                <div>
                  <span className="text-[#555555] text-xs">Started</span>
                  <p className="text-white mt-1">
                    {new Date(project.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <span className="text-[#555555] text-xs">Status</span>
                  <p className="text-green-400 mt-1">Active</p>
                </div>
              </div>
            </div>

            {/* Issue dashboard */}
            <ProjectDashboard planeProjectId={project.plane_project_id} />
          </div>
        ) : (
          <div className="text-center py-24">
            <div className="w-20 h-20 rounded-2xl bg-[#1f1f1f] flex items-center justify-center text-4xl mx-auto mb-6">
              🏗️
            </div>
            <h2 className="text-2xl font-bold text-white mb-3">No project yet</h2>
            <p className="text-[#666666] mb-8 max-w-md mx-auto">
              Start with a template or book a free consultation to get your project set up.
            </p>
            <div className="flex gap-4 justify-center">
              <Link
                href="/templates"
                className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl px-6 py-2.5 text-sm font-medium transition-colors"
              >
                Browse Templates
              </Link>
              <Link
                href="/consult"
                className="bg-[#1f1f1f] hover:bg-[#2a2a2a] border border-[#2a2a2a] text-white rounded-xl px-6 py-2.5 text-sm font-medium transition-colors"
              >
                Book Free Consult
              </Link>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
