import type { Gender, GuestMember, UploadInfo } from '@/types/guest'

type GroupSummaryProps = {
  leadName: string
  leadInstagram: string
  email: string
  leadGender: Gender | ''
  additionalGuests: GuestMember[]
  paymentUpload: UploadInfo | null
}

export function GroupSummary({
  leadName,
  leadInstagram,
  email,
  leadGender,
  additionalGuests,
  paymentUpload,
}: GroupSummaryProps) {
  return (
    <article className="glass-card animate-rise space-y-4">
      <h3 className="text-base font-semibold text-white">Review Summary</h3>

      <div className="space-y-2 text-sm text-zinc-200">
        <p>
          <span className="text-zinc-400">Lead:</span> {leadName || 'Not set'}
        </p>
        <p>
          <span className="text-zinc-400">Instagram:</span>{' '}
          {leadInstagram || 'Not set'}
        </p>
        <p>
          <span className="text-zinc-400">Email:</span> {email || 'Not set'}
        </p>
        <p>
          <span className="text-zinc-400">Gender:</span> {leadGender || 'Not set'}
        </p>
        <p>
          <span className="text-zinc-400">Total People:</span>{' '}
          {additionalGuests.length + 1}
        </p>
        <p>
          <span className="text-zinc-400">Payment:</span>{' '}
          {paymentUpload ? 'Uploaded' : 'Missing'}
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-red-200/80">
          Guest List
        </p>
        <ul className="space-y-2">
          <li className="rounded-xl bg-white/5 px-3 py-2 text-sm text-zinc-100">
            {leadName || 'Lead guest'} ({leadGender || 'unknown'}) - lead
          </li>
          {additionalGuests.map((guest) => (
            <li
              key={guest.id}
              className="rounded-xl bg-white/5 px-3 py-2 text-sm text-zinc-100"
            >
              {guest.fullName || 'Unnamed guest'} ({guest.gender || 'unknown'})
            </li>
          ))}
        </ul>
      </div>
    </article>
  )
}
