import type { GuestMember } from '@/types/guest'

type GuestCardProps = {
  guest: GuestMember
  index: number
  isLead?: boolean
  canRemove?: boolean
  onChange: (id: string, patch: Partial<GuestMember>) => void
  onRemove?: (id: string) => void
}

export function GuestCard({
  guest,
  index,
  isLead = false,
  canRemove = false,
  onChange,
  onRemove,
}: GuestCardProps) {
  return (
    <article className="glass-card animate-rise space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-white">
          {isLead ? 'Lead Guest' : `Guest ${index + 1}`}
        </h3>
        {isLead ? (
          <span className="chip">Lead</span>
        ) : (
          canRemove && (
            <button
              type="button"
              className="btn-outline px-3 py-1 text-xs"
              onClick={() => onRemove?.(guest.id)}
            >
              Remove
            </button>
          )
        )}
      </div>

      <div className="space-y-1.5">
        <label className="field-label" htmlFor={`${guest.id}-fullName`}>
          Full Name
        </label>
        <input
          id={`${guest.id}-fullName`}
          className="field-input"
          value={guest.fullName}
          onChange={(event) =>
            onChange(guest.id, { fullName: event.currentTarget.value })
          }
          placeholder="Guest full name"
          required
        />
      </div>

      <div className="space-y-1.5">
        <label className="field-label" htmlFor={`${guest.id}-instagram`}>
          Instagram Username {isLead ? '' : '(optional)'}
        </label>
        <input
          id={`${guest.id}-instagram`}
          className="field-input"
          value={guest.instagram}
          onChange={(event) =>
            onChange(guest.id, { instagram: event.currentTarget.value })
          }
          placeholder="@handle"
        />
      </div>

      <div className="space-y-1.5">
        <label className="field-label" htmlFor={`${guest.id}-gender`}>
          Gender
        </label>
        <select
          id={`${guest.id}-gender`}
          className="field-input"
          value={guest.gender}
          onChange={(event) =>
            onChange(guest.id, {
              gender: event.currentTarget.value as GuestMember['gender'],
            })
          }
          required
        >
          <option value="">Select gender</option>
          <option value="male">Male</option>
          <option value="female">Female</option>
        </select>
      </div>
    </article>
  )
}
