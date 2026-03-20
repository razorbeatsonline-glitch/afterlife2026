import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { createFileRoute } from '@tanstack/react-router'
import { Activity, Layers3, ScanQrCode, UserRoundPlus } from 'lucide-react'

import {
  fetchDashboardStats,
  fetchRecentSubmissionActivity,
  subscribeAdminRealtime,
} from '@/lib/admin/data'
import type { DashboardStats, SubmissionActivity } from '@/lib/admin/types'
import { getSupabaseClient } from '@/lib/supabase'

export const Route = createFileRoute('/admin/')({
  component: AdminDashboardPage,
})

const DEFAULT_STATS: DashboardStats = {
  newSignupsToday: 0,
  totalSignups: 0,
  totalGroups: 0,
  activeTickets: 0,
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function timeAgo(value: string) {
  const diffMs = Date.now() - new Date(value).getTime()
  const diffMinutes = Math.max(1, Math.floor(diffMs / 60000))

  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`
  }

  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) {
    return `${diffHours}h ago`
  }

  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays}d ago`
}

function AdminDashboardPage() {
  const supabase = useMemo(() => getSupabaseClient(), [])
  const [stats, setStats] = useState<DashboardStats>(DEFAULT_STATS)
  const [activityFeed, setActivityFeed] = useState<SubmissionActivity[]>([])
  const [featuredActivity, setFeaturedActivity] = useState<SubmissionActivity | null>(null)
  const [activityAnimKey, setActivityAnimKey] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [lastUpdatedAt, setLastUpdatedAt] = useState('')
  const latestSeenId = useRef<string | null>(null)

  const refreshDashboard = useCallback(async (silent = false) => {
    if (silent) {
      setIsRefreshing(true)
    } else {
      setIsLoading(true)
    }

    try {
      setError('')

      const [nextStats, nextFeed] = await Promise.all([
        fetchDashboardStats(supabase),
        fetchRecentSubmissionActivity(supabase, 8),
      ])

      setStats(nextStats)
      setActivityFeed(nextFeed)

      const newest = nextFeed[0] ?? null
      if (newest) {
        if (latestSeenId.current && latestSeenId.current !== newest.id) {
          setFeaturedActivity(newest)
          setActivityAnimKey((current) => current + 1)
        } else if (!featuredActivity) {
          setFeaturedActivity(newest)
        }

        latestSeenId.current = newest.id
      }

      setLastUpdatedAt(new Date().toISOString())
    } catch (loadErr) {
      setError(loadErr instanceof Error ? loadErr.message : 'Could not load dashboard data.')
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [featuredActivity, supabase])

  useEffect(() => {
    void refreshDashboard(false)

    const channel = subscribeAdminRealtime(supabase, () => {
      void refreshDashboard(true)
    })

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [refreshDashboard, supabase])

  const cards = [
    {
      label: 'New Signups Today',
      value: stats.newSignupsToday,
      icon: UserRoundPlus,
    },
    {
      label: 'Total Signups So Far',
      value: stats.totalSignups,
      icon: Activity,
    },
    {
      label: 'Total Groups',
      value: stats.totalGroups,
      icon: Layers3,
    },
    {
      label: 'Active Tickets',
      value: stats.activeTickets,
      icon: ScanQrCode,
    },
  ]

  return (
    <div className="space-y-6">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon

          return (
            <article key={card.label} className="admin-stat-card animate-rise">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs uppercase tracking-[0.24em] text-red-100/85">
                  {card.label}
                </p>
                <span className="rounded-lg bg-red-500/12 p-2 text-red-100 shadow-[0_0_18px_rgba(255,54,86,0.35)]">
                  <Icon size={15} />
                </span>
              </div>
              <p className="mt-3 text-3xl font-black text-white">{card.value.toLocaleString()}</p>
            </article>
          )
        })}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.45fr_1fr]">
        <article className="admin-shell-card min-h-[265px] p-5">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-red-200/80">Live Signup Activity</p>
              <h2 className="mt-1 text-2xl font-bold text-white">Real-Time Feed</h2>
            </div>
            <button
              type="button"
              className="btn-outline px-3 py-1.5 text-xs"
              onClick={() => void refreshDashboard(true)}
              disabled={isLoading || isRefreshing}
            >
              {isRefreshing ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>

          {isLoading ? (
            <div className="admin-pulse-card h-24" />
          ) : featuredActivity ? (
            <div key={activityAnimKey} className="admin-activity-feature animate-activity-pop">
              <p className="text-lg font-semibold text-red-50">{featuredActivity.headline}</p>
              <p className="mt-2 text-xs uppercase tracking-[0.2em] text-red-200/75">
                {formatDateTime(featuredActivity.createdAt)}
              </p>
            </div>
          ) : (
            <div className="admin-empty-state">No signup activity yet.</div>
          )}

          <div className="mt-5 space-y-2">
            <p className="text-xs uppercase tracking-[0.22em] text-red-200/75">Recent Entries</p>
            <ul className="space-y-2">
              {activityFeed.slice(0, 6).map((entry) => (
                <li key={entry.id} className="admin-activity-row">
                  <div>
                    <p className="text-sm text-white">{entry.headline.replace(' just signed up 🔥', '')}</p>
                    <p className="text-xs text-zinc-400">
                      {entry.contactEmail ?? entry.submittedByInstagram ?? 'No contact email'}
                    </p>
                  </div>
                  <span className="text-xs uppercase tracking-[0.16em] text-red-200/70">
                    {timeAgo(entry.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </article>

        <article className="admin-shell-card p-5">
          <p className="text-xs uppercase tracking-[0.3em] text-red-200/80">Status</p>
          <h2 className="mt-1 text-2xl font-bold text-white">Live Monitor</h2>
          <div className="mt-5 space-y-3 text-sm text-zinc-200">
            <div className="admin-status-row">
              <span className="admin-status-dot" />
              Realtime subscription active on submissions, groups, members, and tickets.
            </div>
            <div className="admin-status-row">
              <span className="admin-status-dot" />
              Stats and feeds refresh automatically when data changes.
            </div>
            <div className="admin-status-row">
              <span className="admin-status-dot" />
              Last sync: {lastUpdatedAt ? formatDateTime(lastUpdatedAt) : 'Not synced yet'}.
            </div>
          </div>

          {error ? <p className="error-text mt-4">{error}</p> : null}
        </article>
      </section>
    </div>
  )
}
