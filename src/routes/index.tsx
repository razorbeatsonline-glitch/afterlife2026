import { useEffect, useMemo, useState } from 'react'

import { createFileRoute } from '@tanstack/react-router'

import { GroupSummary } from '@/components/GroupSummary'
import { GuestCard } from '@/components/GuestCard'
import { PaymentUpload } from '@/components/PaymentUpload'
import { QRSuccessCard } from '@/components/QRSuccessCard'
import { getSupabaseClient } from '@/lib/supabase'
import { sendTicketEmailPlaceholder } from '@/server/ticket-email.functions'
import type { Gender, GuestMember, SignupSuccess, UploadInfo } from '@/types/guest'

const MAX_GROUP_SIZE = 8
const QR_PAYLOAD_BASE = 'https://yourdomain.com/entry'

export const Route = createFileRoute('/')({
  component: SignupPage,
})

function createGuestMember(): GuestMember {
  return {
    id: crypto.randomUUID(),
    fullName: '',
    instagram: '',
    gender: '',
    personType: 'guest',
  }
}

function trimValue(value: string) {
  return value.trim()
}

function readField<T>(record: Record<string, unknown>, keys: string[], fallback: T): T {
  for (const key of keys) {
    if (key in record) {
      return record[key] as T
    }
  }

  return fallback
}

function asBoolean(value: unknown) {
  if (typeof value === 'boolean') {
    return value
  }

  if (typeof value === 'number') {
    return value === 1
  }

  if (typeof value === 'string') {
    const normalized = value.toLowerCase()
    return normalized === 'true' || normalized === '1' || normalized === 'yes'
  }

  return false
}

function parseSignupResponse(data: unknown): SignupSuccess {
  const row = data as Record<string, unknown> | null

  if (!row) {
    throw new Error('No ticket response received from server.')
  }

  const ticketCode =
    typeof row.ticket_code === 'string'
      ? row.ticket_code
      : readField<string>(row, ['ticketCode'], '')
  const qrPayload =
    typeof row.qr_payload === 'string'
      ? row.qr_payload
      : readField<string>(row, ['qrPayload'], '')

  if (!ticketCode || !qrPayload) {
    throw new Error('Ticket details were incomplete.')
  }

  const membersRaw = readField<unknown>(row, ['members', 'group_members'], [])
  const members = Array.isArray(membersRaw)
    ? membersRaw.map((member) => {
        const payload = member as Record<string, unknown>
        return {
          fullName: readField<string>(payload, ['full_name', 'fullName'], ''),
          instagram: readField<string>(payload, ['instagram', 'instagram_username'], ''),
          gender: readField<string>(payload, ['gender'], ''),
          personType: readField<string>(payload, ['person_type', 'personType'], 'guest'),
        }
      })
    : []

  return {
    ticketCode,
    qrPayload,
    groupCode: readField<string | null>(row, ['group_code', 'groupCode'], null),
    totalPeople: Number(readField<number>(row, ['total_people', 'totalPeople'], 1)),
    members,
    groupCreated: asBoolean(row.group_created),
    groupMerged: asBoolean(readField(row, ['group_merged'], false)),
    ticketReused: asBoolean(row.ticket_reused),
    ticketNew: asBoolean(readField(row, ['ticket_new'], false)),
  }
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  if (typeof error === 'object' && error && 'message' in error) {
    const message = (error as { message?: unknown }).message
    if (typeof message === 'string' && message.trim()) {
      return message
    }
  }

  return 'Submission failed. Please retry.'
}

function SignupPage() {
  const [leadName, setLeadName] = useState('')
  const [leadInstagram, setLeadInstagram] = useState('')
  const [leadEmail, setLeadEmail] = useState('')
  const [leadGender, setLeadGender] = useState<Gender | ''>('')
  const [wantsGroup, setWantsGroup] = useState(false)
  const [additionalGuests, setAdditionalGuests] = useState<GuestMember[]>([])
  const [paymentUpload, setPaymentUpload] = useState<UploadInfo | null>(null)
  const [isPaymentUploading, setIsPaymentUploading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const [success, setSuccess] = useState<SignupSuccess | null>(null)

  const isMaleLead = leadGender === 'male'

  useEffect(() => {
    if (isMaleLead) {
      setWantsGroup(true)
      setAdditionalGuests((current) =>
        current.length ? current : [createGuestMember()],
      )
      return
    }

    setWantsGroup(false)
    setAdditionalGuests([])
  }, [isMaleLead])

  const shouldShowGroupBuilder = isMaleLead || wantsGroup
  const canAddGuest = additionalGuests.length + 1 < MAX_GROUP_SIZE
  const totalPeople = additionalGuests.length + 1

  const hasValidationErrors = useMemo(() => {
    if (!trimValue(leadName)) {
      return true
    }

    if (!trimValue(leadInstagram)) {
      return true
    }

    if (!trimValue(leadEmail) || !/\S+@\S+\.\S+/.test(leadEmail)) {
      return true
    }

    if (!leadGender) {
      return true
    }

    if (!paymentUpload || isPaymentUploading) {
      return true
    }

    if (isMaleLead && additionalGuests.length < 1) {
      return true
    }

    return additionalGuests.some(
      (guest) => !trimValue(guest.fullName) || !guest.gender,
    )
  }, [
    additionalGuests,
    isMaleLead,
    leadEmail,
    leadGender,
    leadInstagram,
    leadName,
    paymentUpload,
    isPaymentUploading,
  ])

  const handleGuestChange = (id: string, patch: Partial<GuestMember>) => {
    setAdditionalGuests((current) =>
      current.map((guest) => (guest.id === id ? { ...guest, ...patch } : guest)),
    )
  }

  const handleGuestRemove = (id: string) => {
    setAdditionalGuests((current) => current.filter((guest) => guest.id !== id))
  }

  const handleAddGuest = () => {
    if (!canAddGuest) {
      return
    }

    setAdditionalGuests((current) => [...current, createGuestMember()])
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (isSubmitting) {
      return
    }

    setFormError('')

    if (hasValidationErrors) {
      setFormError(
        'Please complete all required fields, upload payment, and verify group rules.',
      )
      return
    }

    if (isPaymentUploading) {
      setFormError('Payment upload is still in progress. Please wait to submit.')
      return
    }

    setIsSubmitting(true)

    try {
      const supabase = getSupabaseClient()
      if (!paymentUpload) {
        throw new Error('Payment upload missing. Please upload and retry.')
      }

      const membersPayload = [
        {
          person_type: 'lead',
          full_name: trimValue(leadName),
          instagram: trimValue(leadInstagram),
          gender: leadGender,
          sort_order: 0,
        },
        ...additionalGuests.map((guest, index) => ({
          person_type: 'member',
          full_name: trimValue(guest.fullName),
          instagram: trimValue(guest.instagram),
          gender: guest.gender,
          sort_order: index + 1,
        })),
      ]

      const rawPayload = {
        event: 'Afterlife Club 2026',
        lead: {
          full_name: trimValue(leadName),
          instagram: trimValue(leadInstagram),
          gender: leadGender,
          contact_email: trimValue(leadEmail),
        },
        members: membersPayload,
      }

      const rpcPayload = {
        p_lead_full_name: trimValue(leadName),
        p_lead_instagram: trimValue(leadInstagram),
        p_lead_gender: leadGender,
        p_contact_email: trimValue(leadEmail),
        p_submitted_by_name: trimValue(leadName),
        p_submitted_by_instagram: trimValue(leadInstagram),
        p_submitted_by_gender: leadGender,
        p_payment_screenshot_url: paymentUpload.url,
        p_payment_screenshot_path: paymentUpload.path,
        p_members_json: membersPayload,
        p_raw_payload: rawPayload,
        p_qr_payload_base: QR_PAYLOAD_BASE,
      }

      console.log('create_or_merge_guest_signup payload', rpcPayload)

      const { data, error } = await supabase.rpc(
        'create_or_merge_guest_signup',
        rpcPayload,
      )

      console.log('create_or_merge_guest_signup data', data)
      console.error('create_or_merge_guest_signup error', error)

      if (error) {
        throw error
      }

      const parsed = parseSignupResponse(data)
      setSuccess(parsed)

      try {
        await sendTicketEmailPlaceholder({
          data: {
            eventName: 'Afterlife Club 2026',
            ticketCode: parsed.ticketCode,
            recipientEmail: trimValue(leadEmail),
            qrPayload: parsed.qrPayload,
          },
        })
      } catch {
        // Email placeholder is non-blocking.
      }
    } catch (submitErr) {
      console.error('final submit error', submitErr)
      setFormError(getErrorMessage(submitErr))
    } finally {
      setIsSubmitting(false)
    }
  }

  if (success) {
    return (
      <main className="afterlife-bg min-h-screen px-4 py-8 sm:px-6">
        <div className="mx-auto w-full max-w-3xl">
          <QRSuccessCard success={success} />
        </div>
      </main>
    )
  }

  return (
    <main className="afterlife-bg min-h-screen px-4 py-8 sm:px-6">
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <header className="glass-card animate-rise space-y-3 text-center">
          <h1 className="text-4xl font-black tracking-tight text-white sm:text-5xl">
            Afterlife Club 2026
          </h1>
          <p className="text-sm uppercase tracking-[0.3em] text-red-200">Guest List Access</p>
        </header>

        <form className="space-y-6" onSubmit={handleSubmit}>
          <section className="glass-card animate-rise space-y-4">
            <h2 className="text-xl font-semibold text-white">Lead Guest Details</h2>

            <div className="space-y-1.5">
              <label className="field-label" htmlFor="lead-name">
                Full Name
              </label>
              <input
                id="lead-name"
                className="field-input"
                value={leadName}
                onChange={(event) => setLeadName(event.currentTarget.value)}
                placeholder="Lead guest full name"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="field-label" htmlFor="lead-instagram">
                Instagram Username
              </label>
              <input
                id="lead-instagram"
                className="field-input"
                value={leadInstagram}
                onChange={(event) => setLeadInstagram(event.currentTarget.value)}
                placeholder="@yourhandle"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="field-label" htmlFor="lead-email">
                Email
              </label>
              <input
                id="lead-email"
                type="email"
                className="field-input"
                value={leadEmail}
                onChange={(event) => setLeadEmail(event.currentTarget.value)}
                placeholder="you@example.com"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="field-label" htmlFor="lead-gender">
                Gender
              </label>
              <select
                id="lead-gender"
                className="field-input"
                value={leadGender}
                onChange={(event) =>
                  setLeadGender(event.currentTarget.value as Gender | '')
                }
                required
              >
                <option value="">Select gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </div>
          </section>

          <section className="glass-card animate-rise space-y-4">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-xl font-semibold text-white">Group Builder</h2>
              <span className="chip">{totalPeople} / {MAX_GROUP_SIZE}</span>
            </div>

            {isMaleLead ? (
              <p className="text-sm text-red-100">
                Male guests must sign up with at least one additional guest.
              </p>
            ) : (
              <div className="space-y-2">
                <div
                  className="group-mode-toggle"
                  role="radiogroup"
                  aria-label="Group mode"
                >
                  <button
                    type="button"
                    role="radio"
                    aria-checked={!wantsGroup}
                    className={!wantsGroup ? 'group-mode-option is-active' : 'group-mode-option'}
                    onClick={() => {
                      setWantsGroup(false)
                      setAdditionalGuests([])
                    }}
                  >
                    Solo
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={wantsGroup}
                    className={wantsGroup ? 'group-mode-option is-active' : 'group-mode-option'}
                    onClick={() => setWantsGroup(true)}
                  >
                    Group
                  </button>
                </div>
              </div>
            )}

            {shouldShowGroupBuilder ? (
              <div className="space-y-3">
                {additionalGuests.map((guest, index) => (
                  <GuestCard
                    key={guest.id}
                    guest={guest}
                    index={index}
                    onChange={handleGuestChange}
                    canRemove={!isMaleLead || additionalGuests.length > 1}
                    onRemove={handleGuestRemove}
                  />
                ))}

                <button
                  type="button"
                  className="btn-outline"
                  onClick={handleAddGuest}
                  disabled={!canAddGuest}
                >
                  Add Guest
                </button>
                {!canAddGuest ? (
                  <p className="text-xs text-zinc-400">
                    Max {MAX_GROUP_SIZE} people including lead.
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-zinc-300">You’re signing up solo.</p>
            )}
          </section>

          <PaymentUpload
            leadGender={leadGender}
            value={paymentUpload}
            onUploaded={setPaymentUpload}
            onUploadStatusChange={setIsPaymentUploading}
          />

          <GroupSummary
            leadName={leadName}
            leadInstagram={leadInstagram}
            email={leadEmail}
            leadGender={leadGender}
            additionalGuests={additionalGuests}
            paymentUpload={paymentUpload}
          />

          {formError ? <p className="error-text">{formError}</p> : null}

          <button
            type="submit"
            className="btn-primary w-full"
            disabled={isSubmitting || isPaymentUploading}
          >
            {isSubmitting
              ? 'Submitting...'
              : isPaymentUploading
                ? 'Waiting for upload...'
                : 'Request Guest List Access'}
          </button>
        </form>
      </div>
    </main>
  )
}
