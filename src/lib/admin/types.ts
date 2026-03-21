export type DashboardStats = {
  newSignupsToday: number
  totalSignups: number
  totalGroups: number
  activeTickets: number
}

export type SubmissionActivity = {
  id: string
  groupId: string | null
  createdAt: string
  submittedByName: string | null
  submittedByInstagram: string | null
  contactEmail: string | null
  names: string[]
  headline: string
}

export type AdminGuestListItem = {
  groupId: string
  groupCode: string | null
  leadFullName: string | null
  leadInstagram: string | null
  createdAt: string
  totalPeople: number
  groupStatus: string | null
  activeTicketCode: string | null
  submissionCount: number
  contactEmail: string | null
  latestSubmissionAt: string | null
  ticketStatus: string | null
  latestTicketCode: string | null
}

export type AdminGroupMember = {
  id: string
  fullName: string | null
  instagram: string | null
  gender: string | null
  personType: string | null
  sortOrder: number | null
}

export type AdminGroupDetail = {
  id: string
  groupCode: string | null
  createdAt: string
  status: string | null
  eventCode: string | null
  leadFullName: string | null
  leadInstagram: string | null
  leadGender: string | null
  totalPeople: number
  members: AdminGroupMember[]
  latestSubmission: {
    id: string
    createdAt: string
    contactEmail: string | null
    submittedByName: string | null
    submittedByInstagram: string | null
    submittedByGender: string | null
    status: string | null
    paymentScreenshotUrl: string | null
    paymentScreenshotPath: string | null
    paymentMode: string | null
    totalAmount: number | null
    payerType: string | null
    groupMemberCount: number | null
    femaleCount: number | null
  } | null
  latestTicket: {
    id: string
    ticketCode: string
    status: string | null
    qrPayload: string | null
    issuedAt: string | null
    usedAt: string | null
    lastScanAt: string | null
    lastScanResult: string | null
    scanCount: number | null
  } | null
}
