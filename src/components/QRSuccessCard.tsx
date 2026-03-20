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

export function QRSuccessCard({ success }: QRSuccessCardProps) {
  return (
    <section className="glass-card animate-rise mx-auto w-full max-w-xl space-y-6 p-6 text-center">
      <h1 className="text-3xl font-black tracking-tight text-white">
        Access Requested
      </h1>
      <p className="text-sm text-zinc-300">
        Screenshot and save this QR code. A confirmation email will follow.
      </p>

      <div className="inline-flex rounded-2xl bg-white p-3 shadow-[0_0_50px_rgba(255,50,50,0.35)]">
        <QRCodeSVG value={success.qrPayload} size={220} level="H" />
      </div>

      <div className="grid gap-3 text-left text-sm text-zinc-100 sm:grid-cols-2">
        <p className="rounded-xl bg-white/5 p-3">
          <span className="block text-xs text-zinc-400">Ticket Code</span>
          {success.ticketCode}
        </p>
        <p className="rounded-xl bg-white/5 p-3">
          <span className="block text-xs text-zinc-400">Group Code</span>
          {success.groupCode ?? 'N/A'}
        </p>
        <p className="rounded-xl bg-white/5 p-3 sm:col-span-2">
          <span className="block text-xs text-zinc-400">Group Summary</span>
          {success.totalPeople} people ({getGroupMessage(success)})
        </p>
        <p className="rounded-xl bg-white/5 p-3 sm:col-span-2">
          <span className="block text-xs text-zinc-400">Ticket Lifecycle</span>
          {getTicketMessage(success)}
        </p>
      </div>
    </section>
  )
}
