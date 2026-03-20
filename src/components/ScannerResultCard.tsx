import type { ScanOutcome } from '@/types/guest'

type ScannerResultCardProps = {
  result: ScanOutcome
}

export function ScannerResultCard({ result }: ScannerResultCardProps) {
  const memberNames = (result.members ?? [])
    .map((member) => member.trim())
    .filter(Boolean)
  const isAccepted = result.status === 'accepted'
  const visibleMembers = memberNames.length
    ? memberNames
    : [result.leadGuest || 'Unknown Guest']

  return (
    <article className="glass-card animate-rise space-y-4">
      {isAccepted ? (
        <>
          <h2 className="text-4xl font-black tracking-tight text-white sm:text-5xl">
            {result.leadGuest || 'Unknown Guest'}
          </h2>

          <p className="inline-flex w-fit items-center rounded-full border border-emerald-400/60 bg-emerald-500/15 px-3 py-1 text-sm font-semibold text-emerald-100">
            Check-in confirmed ✅
          </p>

          <div className="space-y-3">
            <p className="text-base font-semibold uppercase tracking-[0.1em] text-red-200">
              Group members:
            </p>

            <div className="space-y-2">
              {visibleMembers.map((memberName, index) => (
                <p
                  key={`${memberName}-${index}`}
                  className="rounded-xl border border-red-500/50 bg-black/75 px-4 py-3 text-2xl font-semibold text-zinc-50"
                >
                  {memberName}
                </p>
              ))}
            </div>
          </div>
        </>
      ) : (
        <p className="rounded-xl border border-red-500/50 bg-black/70 px-4 py-3 text-2xl font-semibold text-zinc-50">
          {result.message || 'Ticket invalid'}
        </p>
      )}
    </article>
  )
}
