import { useCallback, useEffect, useMemo, useState } from 'react'

import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowLeft, Copy, ExternalLink, RefreshCw } from 'lucide-react'

import { fetchAdminGroupDetail, subscribeAdminRealtime } from '@/lib/admin/data'
import type { AdminGroupDetail } from '@/lib/admin/types'
import { getSupabaseClient } from '@/lib/supabase'

export const Route = createFileRoute('/admin/guest/$groupId')({
  component: AdminGuestDetailPage,
})

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return 'N/A'
  }

  return new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
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

async function copyToClipboard(value: string | null | undefined) {
  if (!value?.trim()) {
    return
  }

  await navigator.clipboard.writeText(value)
}

function DetailItem({
  label,
  value,
  copyValue,
}: {
  label: string
  value: string | null | undefined
  copyValue?: string | null
}) {
  const displayValue = value?.trim() ? value : 'N/A'

  return (
    <div className="space-y-2 rounded-2xl border border-white/10 bg-black/20 p-3">
      <p className="text-[0.66rem] uppercase tracking-[0.22em] text-red-200/75">{label}</p>
      <div className="flex items-center justify-between gap-3">
        <p className="break-all text-sm text-zinc-100">{displayValue}</p>
        {copyValue?.trim() ? (
          <button
            type="button"
            className="btn-outline inline-flex items-center gap-1 px-2 py-1 text-[0.65rem]"
            onClick={() => void copyToClipboard(copyValue)}
          >
            <Copy size={12} />
            Copy
          </button>
        ) : null}
      </div>
    </div>
  )
}

function AdminGuestDetailPage() {
  const { groupId } = Route.useParams()
  const supabase = useMemo(() => getSupabaseClient(), [])
  const [detail, setDetail] = useState<AdminGroupDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [previewFailed, setPreviewFailed] = useState(false)

  const loadDetail = useCallback(async (silent = false) => {
    if (silent) {
      setIsRefreshing(true)
    } else {
      setIsLoading(true)
    }

    try {
      setError('')
      const next = await fetchAdminGroupDetail(supabase, groupId)
      setDetail(next)
    } catch (loadErr) {
      setError(loadErr instanceof Error ? loadErr.message : 'Could not load group details.')
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [groupId, supabase])

  useEffect(() => {
    void loadDetail(false)

    const channel = subscribeAdminRealtime(supabase, () => {
      void loadDetail(true)
    })

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [loadDetail, supabase])

  return (
    <section className="space-y-4">
      <article className="admin-shell-card p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <Link to="/admin/guest-list" className="admin-row-link inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em]">
              <ArrowLeft size={14} />
              Back to Guest List
            </Link>
            <h2 className="mt-2 text-2xl font-bold text-white">Guest Group Details</h2>
            <p className="mt-1 text-sm text-zinc-300">Group ID: {groupId}</p>
          </div>

          <button
            type="button"
            className="btn-outline inline-flex items-center gap-2 px-3 py-2 text-xs"
            onClick={() => void loadDetail(true)}
            disabled={isLoading || isRefreshing}
          >
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
            {isRefreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </article>

      {error ? <p className="error-text">{error}</p> : null}

      {isLoading ? (
        <article className="admin-shell-card space-y-3 p-4">
          <div className="admin-pulse-card h-24" />
          <div className="admin-pulse-card h-24" />
          <div className="admin-pulse-card h-24" />
        </article>
      ) : !detail ? (
        <article className="admin-shell-card p-4">
          <div className="admin-empty-state">No group record was found for this ID.</div>
        </article>
      ) : (
        <>
          <section className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
            <article className="admin-shell-card space-y-3 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className={statusChipClass(detail.status)}>{detail.status ?? 'unknown'}</span>
                <span className="admin-chip-muted">{detail.totalPeople} people</span>
                {detail.groupCode ? <span className="admin-chip-muted">{detail.groupCode}</span> : null}
              </div>

              <DetailItem label="Lead Full Name" value={detail.leadFullName} />
              <DetailItem label="Lead Instagram" value={detail.leadInstagram} copyValue={detail.leadInstagram} />
              <DetailItem label="Lead Gender" value={detail.leadGender} />
              <DetailItem label="Event Code" value={detail.eventCode} />
              <DetailItem label="Created" value={formatDateTime(detail.createdAt)} />
            </article>

            <article className="admin-shell-card space-y-3 p-4">
              <h3 className="text-base font-semibold text-white">Latest Submission</h3>

              <DetailItem
                label="Contact Email"
                value={detail.latestSubmission?.contactEmail}
                copyValue={detail.latestSubmission?.contactEmail}
              />
              <DetailItem label="Submitted By" value={detail.latestSubmission?.submittedByName} />
              <DetailItem
                label="Submitted Instagram"
                value={detail.latestSubmission?.submittedByInstagram}
                copyValue={detail.latestSubmission?.submittedByInstagram}
              />
              <DetailItem label="Submission Status" value={detail.latestSubmission?.status} />
              <DetailItem label="Submitted At" value={formatDateTime(detail.latestSubmission?.createdAt)} />
              <DetailItem label="Payment Mode" value={detail.latestSubmission?.paymentMode} />
              <DetailItem
                label="Total Amount"
                value={
                  typeof detail.latestSubmission?.totalAmount === 'number'
                    ? `Rs ${detail.latestSubmission.totalAmount}`
                    : null
                }
              />
              <DetailItem label="Payer Type" value={detail.latestSubmission?.payerType} />
              <DetailItem
                label="Group Size"
                value={
                  typeof detail.latestSubmission?.groupMemberCount === 'number'
                    ? String(detail.latestSubmission.groupMemberCount)
                    : null
                }
              />
              <DetailItem
                label="Female Count"
                value={
                  typeof detail.latestSubmission?.femaleCount === 'number'
                    ? String(detail.latestSubmission.femaleCount)
                    : null
                }
              />

              <div className="space-y-2 rounded-2xl border border-white/10 bg-black/20 p-3">
                <p className="text-[0.66rem] uppercase tracking-[0.22em] text-red-200/75">
                  Payment Screenshot
                </p>
                <p className="break-all text-xs text-zinc-300">
                  {detail.latestSubmission?.paymentScreenshotPath ?? 'No screenshot path available'}
                </p>
                <button
                  type="button"
                  className="btn-primary w-full"
                  disabled={!detail.latestSubmission?.paymentScreenshotUrl}
                  onClick={() => {
                    setPreviewFailed(false)
                    setIsPreviewOpen(true)
                  }}
                >
                  View Payment Screenshot
                </button>
              </div>
            </article>
          </section>

          <section className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
            <article className="admin-shell-card p-4">
              <h3 className="text-base font-semibold text-white">Group Members</h3>
              <div className="mt-3 space-y-2">
                {detail.members.length ? (
                  detail.members.map((member) => (
                    <div key={member.id} className="admin-activity-row">
                      <div>
                        <p className="text-sm text-zinc-100">{member.fullName ?? 'Unnamed member'}</p>
                        <p className="text-xs text-zinc-400">{member.instagram ?? 'No Instagram'}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {member.personType ? (
                          <span className="admin-chip-muted">{member.personType}</span>
                        ) : null}
                        {member.gender ? <span className="admin-chip-muted">{member.gender}</span> : null}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="admin-empty-state">No members found for this group.</div>
                )}
              </div>
            </article>

            <article className="admin-shell-card space-y-3 p-4">
              <h3 className="text-base font-semibold text-white">Ticket</h3>
              <DetailItem
                label="Ticket Code"
                value={detail.latestTicket?.ticketCode}
                copyValue={detail.latestTicket?.ticketCode}
              />
              <DetailItem label="Ticket Status" value={detail.latestTicket?.status} />
              <DetailItem label="Issued At" value={formatDateTime(detail.latestTicket?.issuedAt)} />
              <DetailItem label="Used At" value={formatDateTime(detail.latestTicket?.usedAt)} />
              <DetailItem label="Last Scan" value={formatDateTime(detail.latestTicket?.lastScanAt)} />
              <DetailItem label="Last Scan Result" value={detail.latestTicket?.lastScanResult} />
            </article>
          </section>

          {isPreviewOpen ? (
            <div className="admin-modal-overlay" role="dialog" aria-modal="true">
              <div className="admin-modal-card">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="text-lg font-semibold text-white">Payment Screenshot Preview</h3>
                  <button type="button" className="btn-outline px-3 py-1 text-xs" onClick={() => setIsPreviewOpen(false)}>
                    Close
                  </button>
                </div>

                {detail.latestSubmission?.paymentScreenshotUrl && !previewFailed ? (
                  <img
                    src={detail.latestSubmission.paymentScreenshotUrl}
                    alt="Payment screenshot"
                    className="max-h-[65vh] w-full rounded-xl border border-white/15 object-contain"
                    onError={() => setPreviewFailed(true)}
                  />
                ) : (
                  <div className="admin-empty-state min-h-40">
                    Payment screenshot could not be displayed.
                  </div>
                )}

                {detail.latestSubmission?.paymentScreenshotUrl ? (
                  <a
                    href={detail.latestSubmission.paymentScreenshotUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-outline mt-3 inline-flex items-center gap-2"
                  >
                    <ExternalLink size={14} />
                    Open Original
                  </a>
                ) : null}
              </div>
            </div>
          ) : null}
        </>
      )}
    </section>
  )
}
