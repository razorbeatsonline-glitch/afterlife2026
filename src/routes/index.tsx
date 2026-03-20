import { useEffect, useMemo, useState } from 'react'

import { Link, createFileRoute } from '@tanstack/react-router'

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
  const row = (Array.isArray(data) ? data[0] : data) as
    | Record<string, unknown>
    | undefined

  if (!row) {
    throw new Error('No ticket response received from server.')
  }

  const ticketCode = readField<string>(row, ['ticket_code', 'ticketCode'], '')
  const qrPayload = readField<string>(row, ['qr_payload', 'qrPayload'], '')

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
    groupCreated: asBoolean(readField(row, ['group_created'], false)),
    groupMerged: asBoolean(readField(row, ['group_merged'], false)),
    ticketReused: asBoolean(readField(row, ['ticket_reused'], false)),
    ticketNew: asBoolean(readField(row, ['ticket_new'], false)),
  }
}

function SignupPage() {
  const [leadName, setLeadName] = useState('')
  const [leadInstagram, setLeadInstagram] = useState('')
  const [leadEmail, setLeadEmail] = useState('')
  const [leadGender, setLeadGender] = useState<Gender | ''>('')
  const [wantsGroup, setWantsGroup] = useState(false)
  const [additionalGuests, setAdditionalGuests] = useState<GuestMember[]>([])
  const [paymentUpload, setPaymentUpload] = useState<UploadInfo | null>(null)
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

    if (!paymentUpload) {
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

    setIsSubmitting(true)

    try {
      const supabase = getSupabaseClient()
      const membersPayload = [
        {
          person_type: 'lead',
          full_name: trimValue(leadName),
          instagram: trimValue(leadInstagram),
          gender: leadGender,
        },
        ...additionalGuests.map((guest) => ({
          person_type: 'guest',
          full_name: trimValue(guest.fullName),
          instagram: trimValue(guest.instagram),
          gender: guest.gender,
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

      const { data, error } = await supabase.rpc('create_or_merge_guest_signup', {
        p_lead_full_name: trimValue(leadName),
        p_lead_instagram: trimValue(leadInstagram),
        p_lead_gender: leadGender,
        p_contact_email: trimValue(leadEmail),
        p_submitted_by_name: trimValue(leadName),
        p_submitted_by_instagram: trimValue(leadInstagram),
        p_submitted_by_gender: leadGender,
        p_payment_screenshot_url: paymentUpload?.url,
        p_payment_screenshot_path: paymentUpload?.path,
        p_members_json: membersPayload,
        p_raw_payload: rawPayload,
        p_qr_payload_base: QR_PAYLOAD_BASE,
      })

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
      setFormError(
        submitErr instanceof Error
          ? submitErr.message
          : 'Submission failed. Please retry.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  if (success) {
    return (
      <main className="afterlife-bg min-h-screen px-4 py-8 sm:px-6">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
          <QRSuccessCard success={success} />
          <Link to="/" className="btn-primary text-center">
            Submit Another Request
          </Link>
          <Link to="/gate-scanner" className="btn-outline text-center">
            Open Gate Scanner
          </Link>
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
          <p className="text-sm uppercase tracking-[0.3em] text-red-200">
            Premium Guest List Access
          </p>
          <Link to="/gate-scanner" className="btn-outline mx-auto inline-block">
            Gate Scanner
          </Link>
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
                <option value="other">Other</option>
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
                Male lead requires at least one additional guest.
              </p>
            ) : (
              <label className="flex items-center gap-2 text-sm text-zinc-200">
                <input
                  type="checkbox"
                  checked={wantsGroup}
                  onChange={(event) => {
                    const checked = event.currentTarget.checked
                    setWantsGroup(checked)
                    if (!checked) {
                      setAdditionalGuests([])
                    }
                  }}
                />
                Continue solo or add a group
              </label>
            )}

            <article className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-zinc-200">
              Lead guest is included automatically with <code>person_type='lead'</code>.
            </article>

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
              <p className="text-sm text-zinc-300">Solo entry selected.</p>
            )}
          </section>

          <PaymentUpload value={paymentUpload} onUploaded={setPaymentUpload} />

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
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Submitting...' : 'Request Guest List Access'}
          </button>
        </form>
      </div>
    </main>
  )
}
