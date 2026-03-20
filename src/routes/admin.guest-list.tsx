import { useCallback, useEffect, useMemo, useState } from 'react'

import { Link, createFileRoute } from '@tanstack/react-router'
import { RefreshCw, Search } from 'lucide-react'

import { fetchAdminGuestList, subscribeAdminRealtime } from '@/lib/admin/data'
import type { AdminGuestListItem } from '@/lib/admin/types'
import { getSupabaseClient } from '@/lib/supabase'

export const Route = createFileRoute('/admin/guest-list')({
  component: AdminGuestListPage,
})

function formatDateTime(value: string) {
  return new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function isRecent(value: string) {
  const ageMs = Date.now() - new Date(value).getTime()
  return ageMs <= 1000 * 60 * 60 * 3
}

function matchesQuery(item: AdminGuestListItem, query: string) {
  if (!query) {
    return true
  }

  const haystack = [
    item.leadFullName,
    item.leadInstagram,
    item.contactEmail,
    item.groupCode,
    item.latestTicketCode,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  return haystack.includes(query)
}

function statusChipClass(status: string | null) {
  if (!status) {
    return 'admin-chip-muted'
  }

  if (status === 'active' || status === 'accepted') {
    return 'admin-chip-good'
  }

  if (status === 'used' || status === 'inactive') {
    return 'admin-chip-warn'
  }

  return 'admin-chip-muted'
}

function AdminGuestListPage() {
  const supabase = useMemo(() => getSupabaseClient(), [])
  const [items, setItems] = useState<AdminGuestListItem[]>([])
  const [query, setQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState('')

  const loadList = useCallback(async (silent = false) => {
    if (silent) {
      setIsRefreshing(true)
    } else {
      setIsLoading(true)
    }

    try {
      setError('')
      const nextItems = await fetchAdminGuestList(supabase)
      setItems(nextItems)
    } catch (loadErr) {
      setError(loadErr instanceof Error ? loadErr.message : 'Failed to fetch guest list.')
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [supabase])

  useEffect(() => {
    void loadList(false)

    const channel = subscribeAdminRealtime(supabase, () => {
      void loadList(true)
    })

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [loadList, supabase])

  const normalizedQuery = query.trim().toLowerCase()
  const filteredItems = useMemo(() => {
    return items
      .filter((item) => matchesQuery(item, normalizedQuery))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }, [items, normalizedQuery])

  return (
    <section className="space-y-4">
      <article className="admin-shell-card p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-red-200/80">Guest List</p>
            <h2 className="mt-1 text-2xl font-bold text-white">All Groups and Signups</h2>
          </div>

          <button
            type="button"
            className="btn-outline inline-flex items-center gap-2 px-3 py-2 text-xs"
            onClick={() => void loadList(true)}
            disabled={isLoading || isRefreshing}
          >
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
            {isRefreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>

        <label htmlFor="admin-guest-search" className="sr-only">
          Search guest list
        </label>
        <div className="relative mt-4">
          <Search size={16} className="pointer-events-none absolute left-3 top-3 text-zinc-400" />
          <input
            id="admin-guest-search"
            className="field-input pl-10"
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
            placeholder="Search by name, Instagram, or email"
          />
        </div>
      </article>

      {error ? <p className="error-text">{error}</p> : null}

      <article className="admin-shell-card overflow-hidden p-0">
        {isLoading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="admin-pulse-card h-20" />
            ))}
          </div>
        ) : filteredItems.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-white/12 bg-black/20 text-left text-xs uppercase tracking-[0.18em] text-red-100/90">
                  <th className="px-4 py-3">Lead Guest</th>
                  <th className="px-4 py-3">Contact</th>
                  <th className="px-4 py-3">Group</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3">Ticket</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => (
                  <tr key={item.groupId} className="admin-table-row">
                    <td className="px-4 py-3 align-top">
                      <Link to="/admin/guest/$groupId" params={{ groupId: item.groupId }} className="admin-row-link">
                        {item.leadFullName ?? 'Unnamed lead'}
                      </Link>
                      <p className="mt-1 text-xs text-zinc-400">{item.leadInstagram ?? 'No Instagram'}</p>
                    </td>
                    <td className="px-4 py-3 align-top text-zinc-200">{item.contactEmail ?? 'No email'}</td>
                    <td className="px-4 py-3 align-top">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="admin-chip-muted">{item.totalPeople} people</span>
                        {item.groupCode ? <span className="admin-chip-muted">{item.groupCode}</span> : null}
                        {isRecent(item.createdAt) ? <span className="admin-chip-good">new</span> : null}
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top text-zinc-300">{formatDateTime(item.createdAt)}</td>
                    <td className="px-4 py-3 align-top text-zinc-200">
                      {item.latestTicketCode ?? item.activeTicketCode ?? 'Not issued'}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <span className={statusChipClass(item.ticketStatus)}>
                        {item.ticketStatus ?? item.groupStatus ?? 'unknown'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="admin-empty-state m-4">
            No guests matched the current search.
          </div>
        )}
      </article>
    </section>
  )
}
