'use client'

import Link from 'next/link'

interface SessionSummaryProps {
  summary: string
  nextSteps?: string[]
  upgradePrompt?: string
}

export function SessionSummary({ summary, nextSteps, upgradePrompt }: SessionSummaryProps) {
  return (
    <div className="space-y-6" data-testid="session-summary">
      {/* Summary card */}
      <div className="bg-[#111111] border border-[#2a2a2a] rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
          <span className="text-xl">📋</span>
          Session Summary
        </h3>
        <p className="text-[#aaaaaa] text-sm leading-relaxed">{summary}</p>
      </div>

      {/* Next steps */}
      {nextSteps && nextSteps.length > 0 && (
        <div className="bg-[#111111] border border-[#2a2a2a] rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
            <span className="text-xl">🚀</span>
            Recommended Next Steps
          </h3>
          <ol className="space-y-2">
            {nextSteps.map((step, idx) => (
              <li key={idx} className="flex items-start gap-3 text-sm text-[#aaaaaa]">
                <span className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                  {idx + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Upgrade CTA */}
      {upgradePrompt && (
        <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
            <span className="text-xl">⚡</span>
            Ready to go further?
          </h3>
          <p className="text-[#aaaaaa] text-sm leading-relaxed mb-4">{upgradePrompt}</p>
          <div className="flex gap-3">
            <Link
              href="/templates"
              className="flex-1 text-center bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg px-4 py-2.5 text-sm font-medium transition-colors"
            >
              Explore Templates
            </Link>
            <Link
              href="/consult"
              className="flex-1 text-center bg-[#1f1f1f] hover:bg-[#2a2a2a] text-white rounded-lg px-4 py-2.5 text-sm font-medium transition-colors border border-[#2a2a2a]"
            >
              Book Another Session
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

export default SessionSummary
