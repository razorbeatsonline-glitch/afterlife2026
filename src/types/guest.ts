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
  status: 'accepted' | 'already_used' | 'invalid' | 'inactive'
  message: string
  ticketCode?: string
  leadGuest?: string
  leadInstagram?: string
  leadGender?: string
  totalPeople?: number
  groupCode?: string | null
  members?: Array<{
    fullName: string
    instagram: string
    gender: string
    personType?: string
  }>
}
