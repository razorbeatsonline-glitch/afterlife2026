import { useEffect, useMemo, useState } from 'react'

import { createFileRoute } from '@tanstack/react-router'

import { GroupSummary } from '@/components/GroupSummary'
import { GuestCard } from '@/components/GuestCard'
import { PaymentUpload } from '@/components/PaymentUpload'
import { QRSuccessCard } from '@/components/QRSuccessCard'
import { getSupabaseClient } from '@/lib/supabase'
import type { Gender, GuestMember, SignupSuccess, UploadInfo } from '@/types/guest'

const MAX_GROUP_SIZE = 8
const QR_PAYLOAD_BASE = 'https://yourdomain.com/entry'
const STEP_ENTER_MS = 220
const STEP_EXIT_MS = 220
const CHECKMARK_MS = 500
const EMAIL_PATTERN = /\S+@\S+\.\S+/

type PaymentMode = 'pay_self' | 'pay_group' | 'group_paid'
type PayerType = 'self' | 'group' | 'covered'
type FlowStepId =
  | 'lead_name'
  | 'lead_instagram'
  | 'lead_email'
  | 'lead_gender'
  | 'group_builder'
  | 'payment_mode'
  | 'payment_upload'
  | 'submit'

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
  const [paymentMode, setPaymentMode] = useState<PaymentMode | ''>('')
  const [isPaymentUploading, setIsPaymentUploading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const [success, setSuccess] = useState<SignupSuccess | null>(null)
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [showStepCheckmark, setShowStepCheckmark] = useState(false)
  const [isStepExiting, setIsStepExiting] = useState(false)

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
  const steps: Array<{ id: FlowStepId; title: string }> = useMemo(
    () => [
      { id: 'lead_name', title: 'Full Name' },
      { id: 'lead_instagram', title: 'Instagram' },
      { id: 'lead_email', title: 'Email' },
      { id: 'lead_gender', title: 'Gender' },
      { id: 'group_builder', title: 'Group Builder' },
      { id: 'payment_mode', title: 'How are you paying?' },
      { id: 'payment_upload', title: 'Payment Screenshot' },
      { id: 'submit', title: 'Submit' },
    ],
    [],
  )
  const currentStep = steps[currentStepIndex] ?? steps[0]
  const isLastStep = currentStepIndex >= steps.length - 1
  const femaleMemberCount = useMemo(
    () => additionalGuests.filter((member) => member.gender === 'female').length,
    [additionalGuests],
  )
  const femaleCount = useMemo(() => {
    const leadFemaleCount = leadGender === 'female' ? 1 : 0
    return leadFemaleCount + femaleMemberCount
  }, [leadGender, femaleMemberCount])
  const leadPrice = leadGender === 'female' ? 1500 : leadGender === 'male' ? 2000 : 0
  const groupPrice = useMemo(() => {
    const membersTotal = additionalGuests.reduce((sum, member) => {
      if (member.gender === 'female') {
        return sum + 1500
      }

      if (member.gender === 'male') {
        return sum + 2000
      }

      return sum
    }, 0)

    return leadPrice + membersTotal
  }, [additionalGuests, leadPrice])
  const calculatedTotalAmount = paymentMode === 'pay_group' ? groupPrice : leadPrice
  const payerType: PayerType =
    paymentMode === 'pay_group'
      ? 'group'
      : paymentMode === 'group_paid'
        ? 'covered'
        : 'self'

  const hasValidationErrors = useMemo(() => {
    if (!trimValue(leadName)) {
      return true
    }

    if (!trimValue(leadInstagram)) {
      return true
    }

    if (!trimValue(leadEmail) || !EMAIL_PATTERN.test(leadEmail)) {
      return true
    }

    if (!leadGender) {
      return true
    }

    if (!paymentUpload || isPaymentUploading) {
      return true
    }

    if (isMaleLead && femaleMemberCount < 1) {
      return true
    }

    if (shouldShowGroupBuilder && additionalGuests.some(
      (guest) => !trimValue(guest.fullName) || !guest.gender,
    )) {
      return true
    }

    return !paymentMode
  }, [
    additionalGuests,
    femaleMemberCount,
    isMaleLead,
    paymentMode,
    leadEmail,
    leadGender,
    leadInstagram,
    leadName,
    paymentUpload,
    isPaymentUploading,
    shouldShowGroupBuilder,
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

  const validateStep = (stepId: FlowStepId) => {
    if (stepId === 'lead_name') {
      const isValid = trimValue(leadName).length > 0
      if (!isValid) {
        setFormError('Full name is required.')
      }
      return isValid
    }

    if (stepId === 'lead_instagram') {
      const isValid = trimValue(leadInstagram).length > 0
      if (!isValid) {
        setFormError('Instagram username is required.')
      }
      return isValid
    }

    if (stepId === 'lead_email') {
      const isValid = trimValue(leadEmail).length > 0 && EMAIL_PATTERN.test(leadEmail)
      if (!isValid) {
        setFormError('A valid email is required.')
      }
      return isValid
    }

    if (stepId === 'lead_gender') {
      const isValid = Boolean(leadGender)
      if (!isValid) {
        setFormError('Please select your gender.')
      }
      return isValid
    }

    if (stepId === 'group_builder') {
      if (isMaleLead && additionalGuests.length < 1) {
        setFormError('Male guests must add at least one group member.')
        return false
      }

      if (shouldShowGroupBuilder) {
        const hasIncompleteGuest = additionalGuests.some(
          (guest) => !trimValue(guest.fullName) || !guest.gender,
        )
        if (hasIncompleteGuest) {
          setFormError('Please complete all group member details.')
          return false
        }
      }

      if (isMaleLead && femaleMemberCount < 1) {
        setFormError('At least one female guest is required to proceed.')
        return false
      }

      return true
    }

    if (stepId === 'payment_mode') {
      const isValid = Boolean(paymentMode)
      if (!isValid) {
        setFormError('Please choose how you are paying.')
      }
      return isValid
    }

    if (stepId === 'payment_upload') {
      if (isPaymentUploading) {
        setFormError('Payment upload is still in progress. Please wait.')
        return false
      }

      if (!paymentUpload) {
        setFormError('Please upload payment screenshot to continue.')
        return false
      }

      return true
    }

    return true
  }

  const handleNextStep = () => {
    if (!currentStep || isLastStep || isTransitioning) {
      return
    }

    setFormError('')
    if (!validateStep(currentStep.id)) {
      return
    }

    setIsTransitioning(true)
    setShowStepCheckmark(true)
    setIsStepExiting(false)

    window.setTimeout(() => {
      setIsStepExiting(true)
      window.setTimeout(() => {
        setCurrentStepIndex((current) => Math.min(current + 1, steps.length - 1))
        setShowStepCheckmark(false)
        setIsStepExiting(false)
        window.setTimeout(() => {
          setIsTransitioning(false)
        }, STEP_ENTER_MS)
      }, STEP_EXIT_MS)
    }, CHECKMARK_MS)
  }

  const handlePreviousStep = () => {
    if (!currentStep || currentStepIndex <= 0 || isTransitioning) {
      return
    }

    setFormError('')
    setCurrentStepIndex((current) => Math.max(current - 1, 0))
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
        payment_mode: paymentMode,
        calculated_total_amount: paymentMode === 'group_paid' ? null : calculatedTotalAmount,
        payer_type: payerType,
        group_member_count: additionalGuests.length,
        female_count: femaleCount,
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
        const emailResponse = await fetch('/.netlify/functions/send-ticket-email', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            email: trimValue(leadEmail),
            name: trimValue(leadName),
            qrCodeUrl: parsed.qrPayload,
            ticketCode: parsed.ticketCode,
            paymentMode: paymentMode as PaymentMode,
            groupMembers: additionalGuests.map((guest) => ({
              name: trimValue(guest.fullName),
              instagram: trimValue(guest.instagram),
              gender: guest.gender,
            })),
          }),
        })

        if (!emailResponse.ok) {
          throw new Error('Ticket email request failed.')
        }
      } catch {
        // Ticket email send is intentionally non-blocking.
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
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-red-200/75">
                  Question {currentStepIndex + 1} of {steps.length}
                </p>
                <h2 className="text-xl font-semibold text-white">{currentStep.title}</h2>
              </div>
              <span className="chip">{Math.round(((currentStepIndex + 1) / steps.length) * 100)}%</span>
            </div>

            <div
              key={currentStep.id}
              className={isStepExiting ? 'flow-step-panel is-exiting' : 'flow-step-panel'}
            >
              {currentStep.id === 'lead_name' ? (
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
                    autoFocus
                  />
                </div>
              ) : null}

              {currentStep.id === 'lead_instagram' ? (
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
                    autoFocus
                  />
                </div>
              ) : null}

              {currentStep.id === 'lead_email' ? (
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
                    autoFocus
                  />
                </div>
              ) : null}

              {currentStep.id === 'lead_gender' ? (
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
                    autoFocus
                  >
                    <option value="">Select gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select>
                </div>
              ) : null}

              {currentStep.id === 'group_builder' ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <h3 className="text-lg font-semibold text-white">Group Builder</h3>
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
                      {isMaleLead && femaleMemberCount < 1 ? (
                        <p className="error-text">
                          At least one female guest is required to proceed.
                        </p>
                      ) : null}
                    </div>
                  ) : (
                    <p className="text-sm text-zinc-300">You’re signing up solo.</p>
                  )}
                </div>
              ) : null}

              {currentStep.id === 'payment_mode' ? (
                <div className="space-y-3">
                  <div className="payment-mode-grid" role="radiogroup" aria-label="Payment mode">
                    <button
                      type="button"
                      role="radio"
                      aria-checked={paymentMode === 'pay_self'}
                      className={paymentMode === 'pay_self' ? 'payment-mode-option is-active' : 'payment-mode-option'}
                      onClick={() => setPaymentMode('pay_self')}
                    >
                      <span className="payment-mode-title">Paying for myself</span>
                      <span className="payment-mode-desc">Only your amount applies.</span>
                    </button>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={paymentMode === 'pay_group'}
                      className={paymentMode === 'pay_group' ? 'payment-mode-option is-active' : 'payment-mode-option'}
                      onClick={() => setPaymentMode('pay_group')}
                    >
                      <span className="payment-mode-title">Paying for entire group</span>
                      <span className="payment-mode-desc">You + your group</span>
                    </button>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={paymentMode === 'group_paid'}
                      className={paymentMode === 'group_paid' ? 'payment-mode-option is-active' : 'payment-mode-option'}
                      onClick={() => setPaymentMode('group_paid')}
                    >
                      <span className="payment-mode-title">My group has already paid for me</span>
                      <span className="payment-mode-desc">You&apos;re already covered</span>
                    </button>
                  </div>
                </div>
              ) : null}

              {currentStep.id === 'payment_upload' ? (
                <PaymentUpload
                  leadGender={leadGender}
                  value={paymentUpload}
                  paymentMode={paymentMode}
                  totalAmount={calculatedTotalAmount}
                  onUploaded={setPaymentUpload}
                  onUploadStatusChange={setIsPaymentUploading}
                />
              ) : null}

              {currentStep.id === 'submit' ? (
                <GroupSummary
                  leadName={leadName}
                  leadInstagram={leadInstagram}
                  email={leadEmail}
                  leadGender={leadGender}
                  additionalGuests={additionalGuests}
                  paymentUpload={paymentUpload}
                />
              ) : null}
            </div>

            <div className="flow-controls">
              <button
                type="button"
                className="btn-outline px-4"
                onClick={handlePreviousStep}
                disabled={currentStepIndex === 0 || isTransitioning || isSubmitting}
              >
                Back
              </button>
              {!isLastStep ? (
                <button
                  type="button"
                  className="btn-primary inline-flex min-w-32 items-center justify-center px-4"
                  onClick={handleNextStep}
                  disabled={isTransitioning || isSubmitting || isPaymentUploading}
                >
                  {showStepCheckmark ? <span className="flow-checkmark">✓</span> : 'Continue'}
                </button>
              ) : null}
            </div>
          </section>

          {formError ? <p className="error-text">{formError}</p> : null}

          <button
            type="submit"
            className="btn-primary w-full"
            disabled={isSubmitting || isPaymentUploading || currentStep.id !== 'submit'}
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
