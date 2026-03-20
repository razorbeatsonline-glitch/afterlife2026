import type { ScanOutcome } from '@/types/guest'

type ScannerResultCardProps = {
  result: ScanOutcome
}

const statusLabel: Record<ScanOutcome['status'], string> = {
  accepted: 'Accepted',
  already_used: 'Already Used',
  invalid: 'Invalid',
  inactive: 'Inactive',
}

export function ScannerResultCard({ result }: ScannerResultCardProps) {
  return (
    <article className="glass-card animate-rise space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-white">Scan Result</h2>
        <span className="chip">{statusLabel[result.status]}</span>
      </div>

      <p className="text-sm text-zinc-300">{result.message}</p>

      {result.status === 'accepted' ? (
        <div className="grid gap-2 text-sm text-zinc-100">
          <p>
            <span className="text-zinc-400">Lead Guest:</span>{' '}
            {result.leadGuest ?? 'N/A'}
          </p>
          <p>
            <span className="text-zinc-400">Instagram:</span>{' '}
            {result.leadInstagram ?? 'N/A'}
          </p>
          <p>
            <span className="text-zinc-400">Gender:</span>{' '}
            {result.leadGender ?? 'N/A'}
          </p>
          <p>
            <span className="text-zinc-400">Total People:</span>{' '}
            {result.totalPeople ?? 'N/A'}
          </p>
          <p>
            <span className="text-zinc-400">Group Code:</span>{' '}
            {result.groupCode ?? 'N/A'}
          </p>
          <p>
            <span className="text-zinc-400">Ticket Code:</span>{' '}
            {result.ticketCode ?? 'N/A'}
          </p>

          {result.members?.length ? (
            <ul className="mt-2 space-y-2">
              {result.members.map((member, index) => (
                <li
                  key={`${member.fullName}-${index}`}
                  className="rounded-xl bg-white/5 px-3 py-2"
                >
                  {member.fullName} ({member.gender || 'unknown'})
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </article>
  )
}
