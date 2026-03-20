export type Gender = 'male' | 'female' | 'other'

export type GuestMember = {
  id: string
  fullName: string
  instagram: string
  gender: Gender | ''
  personType: 'lead' | 'guest'
}

export type UploadInfo = {
  url: string
  path: string
}

export type SignupSuccess = {
  ticketCode: string
  qrPayload: string
  groupCode: string | null
  totalPeople: number
  members: Array<{
    fullName: string
    instagram: string
    gender: string
    personType: string
  }>
  groupCreated: boolean
  groupMerged: boolean
  ticketReused: boolean
  ticketNew: boolean
}

export type ScanOutcome = {
  status: 'accepted' | 'already_used' | 'invalid' | 'inactive' | 'error'
  message: string
  ticketCode?: string
  leadGuest?: string
  membersDebug?: string
  members?: string[]
}
