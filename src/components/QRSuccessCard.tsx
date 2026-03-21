import { QRCodeSVG } from 'qrcode.react'

import type { SignupSuccess } from '@/types/guest'

type QRSuccessCardProps = {
  success: SignupSuccess
}

function getTicketMessage(success: SignupSuccess) {
  if (success.ticketReused) {
    return 'Existing ticket reused for this request.'
  }

  if (success.ticketNew) {
    return 'New ticket generated for this request.'
  }

  return 'Ticket status returned by server.'
}

function getGroupMessage(success: SignupSuccess) {
  if (success.groupMerged) {
    return 'Existing group was merged.'
  }

  if (success.groupCreated) {
    return 'New group was created.'
  }

  return 'Group status returned by server.'
}

function getGroupSummary(success: SignupSuccess) {
  if (success.totalPeople === 1 && success.groupCreated) {
    return "Just you — you're all set."
  }

  return `${success.totalPeople} people (${getGroupMessage(success)})`
}

export function QRSuccessCard({ success }: QRSuccessCardProps) {
  return (
    <section className="glass-card animate-rise mx-auto w-full max-w-xl space-y-6 p-6 text-center">
      <h1 className="text-3xl font-black tracking-tight text-white">
        YOU'RE ON THE GUEST LIST ✨
      </h1>
      <p className="text-sm text-zinc-300">
        Screenshot this QR code — it will be used for entry at the gate on event day.
      </p>

      <div className="inline-flex rounded-2xl bg-white p-3 shadow-[0_0_50px_rgba(255,50,50,0.35)]">
        <QRCodeSVG value={success.qrPayload} size={220} level="H" />
      </div>

      <div className="grid gap-3 text-left text-sm text-zinc-100 sm:grid-cols-2">
        <p className="rounded-xl bg-white/5 p-3">
          <span className="block text-xs text-zinc-400">Your Ticket</span>
          {success.ticketCode}
        </p>
        <p className="rounded-xl bg-white/5 p-3">
          <span className="block text-xs text-zinc-400">Group Code</span>
          {success.groupCode ?? 'N/A'}
        </p>
        <p className="rounded-xl bg-white/5 p-3 sm:col-span-2">
          <span className="block text-xs text-zinc-400">Your Group</span>
          {getGroupSummary(success)}
        </p>
        <p className="rounded-xl bg-white/5 p-3 sm:col-span-2">
          <span className="block text-xs text-zinc-400">Status</span>
          {getTicketMessage(success)}
        </p>
      </div>
    </section>
  )
}
