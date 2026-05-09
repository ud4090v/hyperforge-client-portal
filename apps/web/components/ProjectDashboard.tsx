'use client'

import { useEffect, useState, useCallback } from 'react'
import { createBrowserClient } from '@/lib/supabase'
import { getProjectIssues, type PlaneIssue } from '@/lib/plane-client'

interface ProjectDashboardProps {
  planeProjectId: string
}

const PRIORITY_COLORS: Record<string, string> = {
  urgent: '#ef4444',
  high: '#f59e0b',
  medium: '#6366f1',
  low: '#10b981',
  none: '#555555',
}

const PRIORITY_LABELS: Record<string, string> = {
  urgent: 'Urgent',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
  none: 'No priority',
}

function PriorityBadge({ priority }: { priority: string }) {
  const color = PRIORITY_COLORS[priority] ?? '#555555'
  const label = PRIORITY_LABELS[priority] ?? priority
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ backgroundColor: `${color}20`, color }}
    >
      {label}
    </span>
  )
}

function StateBadge({ state }: { state: PlaneIssue['state'] }) {
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ backgroundColor: `${state.color}20`, color: state.color }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ backgroundColor: state.color }}
      />
      {state.name}
    </span>
  )
}

function IssueRow({ issue }: { issue: PlaneIssue }) {
  return (
    <div
      className="flex items-start gap-4 p-4 border-b border-[#1f1f1f] last:border-0 hover:bg-[#111111]/50 transition-colors"
      data-testid="issue-row"
    >
      <span className="text-xs text-[#555555] font-mono w-12 flex-shrink-0 pt-0.5">
        #{issue.sequence_id}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white font-medium truncate">{issue.name}</p>
        {issue.description_html && (
          <p
            className="text-xs text-[#666666] mt-1 line-clamp-2"
            dangerouslySetInnerHTML={{ __html: issue.description_html }}
          />
        )}
        {issue.comments && issue.comments.length > 0 && (
          <div className="mt-2 space-y-1">
            {issue.comments.map((comment) => (
              <div
                key={comment.id}
                className="text-xs text-[#888888] bg-[#1a1a1a] rounded px-3 py-1.5"
              >
                <span className="text-[#555555]">{comment.actor.display_name}: </span>
                <span
                  dangerouslySetInnerHTML={{ __html: comment.comment_html }}
                />
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        <StateBadge state={issue.state} />
        <PriorityBadge priority={issue.priority} />
      </div>
    </div>
  )
}

export function ProjectDashboard({ planeProjectId }: ProjectDashboardProps) {
  const [issues, setIssues] = useState<PlaneIssue[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const fetchIssues = useCallback(async () => {
    try {
      const supabase = createBrowserClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('Not authenticated')

      const data = await getProjectIssues(planeProjectId, session.access_token)
      setIssues(data)
      setLastUpdated(new Date())
      setError(null)
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }, [planeProjectId])

  // Initial fetch
  useEffect(() => {
    void fetchIssues()
  }, [fetchIssues])

  // Poll every 30s
  useEffect(() => {
    const interval = setInterval(() => {
      void fetchIssues()
    }, 30_000)
    return () => clearInterval(interval)
  }, [fetchIssues])

  // Realtime subscription via Supabase
  useEffect(() => {
    if (typeof window === 'undefined') return

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!supabaseUrl || !supabaseAnonKey) return

    import('@supabase/supabase-js').then(({ createClient }) => {
      const supabase = createClient(supabaseUrl, supabaseAnonKey)
      const channel = supabase
        .channel(`project:${planeProjectId}`)
        .on('broadcast', { event: 'ISSUES_UPDATED' }, () => {
          void fetchIssues()
        })
        .subscribe()

      return () => {
        channel.unsubscribe()
      }
    })
  }, [planeProjectId, fetchIssues])

  if (loading) {
    return (
      <div className="bg-[#111111] border border-[#2a2a2a] rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-[#888888]">Loading project status…</span>
        </div>
        {/* Skeleton rows */}
        {[1, 2, 3].map((n) => (
          <div key={n} className="h-12 bg-[#1a1a1a] rounded-lg mb-2 animate-pulse" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6">
        <p className="text-sm text-red-400">Failed to load project data: {error}</p>
        <button
          onClick={() => void fetchIssues()}
          className="mt-3 text-xs text-red-400 hover:text-red-300 underline"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="bg-[#111111] border border-[#2a2a2a] rounded-xl overflow-hidden" data-testid="project-dashboard">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a2a2a]">
        <div>
          <h2 className="text-lg font-semibold text-white">Project Status</h2>
          <p className="text-xs text-[#555555] mt-0.5">
            {issues.length} {issues.length === 1 ? 'item' : 'items'} •
            {lastUpdated && ` Updated ${lastUpdated.toLocaleTimeString()}`}
          </p>
        </div>
        <button
          onClick={() => void fetchIssues()}
          className="text-xs text-[#666666] hover:text-white transition-colors border border-[#2a2a2a] hover:border-[#3a3a3a] rounded-lg px-3 py-1.5"
        >
          Refresh
        </button>
      </div>

      {/* Issue list */}
      {issues.length === 0 ? (
        <div className="px-6 py-12 text-center">
          <p className="text-[#555555] text-sm">No project items yet.</p>
          <p className="text-[#444444] text-xs mt-1">
            We&apos;ll be in touch within 1 business day to kick things off.
          </p>
        </div>
      ) : (
        <div>
          {issues.map((issue) => (
            <IssueRow key={issue.id} issue={issue} />
          ))}
        </div>
      )}
    </div>
  )
}

export default ProjectDashboard
