import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js'

import type {
  AdminGroupDetail,
  AdminGuestListItem,
  DashboardStats,
  SubmissionActivity,
} from './types'

type SubmissionRow = {
  id: string
  group_id: string | null
  created_at: string
  submitted_by_name: string | null
  submitted_by_instagram: string | null
  contact_email: string | null
}

type MemberRow = {
  group_id: string
  full_name: string | null
  sort_order: number | null
}

type GroupSummaryRow = {
  group_id: string
  group_code: string | null
  lead_full_name: string | null
  lead_instagram: string | null
  created_at: string
  total_people: number | null
  group_status: string | null
  active_ticket_code: string | null
  submission_count: number | null
}

type GroupDetailRow = {
  id: string
  group_code: string | null
  created_at: string
  status: string | null
  event_code: string | null
  lead_full_name: string | null
  lead_instagram: string | null
  lead_gender: string | null
  total_people: number | null
}

type GroupMemberDetailRow = {
  id: string
  full_name: string | null
  instagram: string | null
  gender: string | null
  person_type: string | null
  sort_order: number | null
}

type GroupSubmissionDetailRow = {
  id: string
  created_at: string
  contact_email: string | null
  submitted_by_name: string | null
  submitted_by_instagram: string | null
  submitted_by_gender: string | null
  status: string | null
  payment_screenshot_url: string | null
  payment_screenshot_path: string | null
}

type GroupTicketDetailRow = {
  id: string
  ticket_code: string
  status: string | null
  qr_payload: string | null
  issued_at: string | null
  used_at: string | null
  last_scan_at: string | null
  last_scan_result: string | null
  scan_count: number | null
}

function startOfUtcDayIso() {
  const now = new Date()
  const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  return dayStart.toISOString()
}

function buildHeadline(names: string[], fallbackName?: string | null) {
  const cleanNames = names.map((name) => name.trim()).filter(Boolean)

  if (cleanNames.length === 1) {
    return `${cleanNames[0]} just signed up 🔥`
  }

  if (cleanNames.length === 2) {
    return `${cleanNames[0]} and ${cleanNames[1]} just signed up 🔥`
  }

  if (cleanNames.length > 2) {
    const remaining = cleanNames.length - 2
    return `${cleanNames[0]}, ${cleanNames[1]}, and ${remaining} more just signed up 🔥`
  }

  if (fallbackName?.trim()) {
    return `${fallbackName.trim()} just signed up 🔥`
  }

  return 'A new guest just signed up 🔥'
}

async function loadNamesByGroup(
  supabase: SupabaseClient,
  groupIds: string[],
) {
  if (!groupIds.length) {
    return new Map<string, string[]>()
  }

  const { data: members, error: memberErr } = await supabase
    .from('guest_list_members')
    .select('group_id, full_name, sort_order')
    .in('group_id', groupIds)
    .order('sort_order', { ascending: true })

  if (memberErr) {
    throw memberErr
  }

  const namesByGroup = new Map<string, string[]>()

  for (const member of (members ?? []) as MemberRow[]) {
    const list = namesByGroup.get(member.group_id) ?? []
    if (member.full_name?.trim()) {
      list.push(member.full_name.trim())
    }
    namesByGroup.set(member.group_id, list)
  }

  return namesByGroup
}

function createActivities(
  submissions: SubmissionRow[],
  namesByGroup: Map<string, string[]>,
) {
  return submissions.map<SubmissionActivity>((submission) => {
    const names = submission.group_id ? (namesByGroup.get(submission.group_id) ?? []) : []

    return {
      id: submission.id,
      groupId: submission.group_id,
      createdAt: submission.created_at,
      submittedByName: submission.submitted_by_name,
      submittedByInstagram: submission.submitted_by_instagram,
      contactEmail: submission.contact_email,
      names,
      headline: buildHeadline(names, submission.submitted_by_name),
    }
  })
}

export async function fetchDashboardStats(supabase: SupabaseClient): Promise<DashboardStats> {
  const todayIso = startOfUtcDayIso()

  const [todayRes, totalSubmissionsRes, totalGroupsRes, activeTicketsRes] = await Promise.all([
    supabase
      .from('guest_list_submissions')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', todayIso),
    supabase
      .from('guest_list_submissions')
      .select('*', { count: 'exact', head: true }),
    supabase
      .from('guest_list_groups')
      .select('*', { count: 'exact', head: true }),
    supabase
      .from('guest_list_tickets')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active'),
  ])

  if (todayRes.error) {
    throw todayRes.error
  }

  if (totalSubmissionsRes.error) {
    throw totalSubmissionsRes.error
  }

  if (totalGroupsRes.error) {
    throw totalGroupsRes.error
  }

  if (activeTicketsRes.error) {
    throw activeTicketsRes.error
  }

  return {
    newSignupsToday: todayRes.count ?? 0,
    totalSignups: totalSubmissionsRes.count ?? 0,
    totalGroups: totalGroupsRes.count ?? 0,
    activeTickets: activeTicketsRes.count ?? 0,
  }
}

export async function fetchRecentSubmissionActivity(
  supabase: SupabaseClient,
  limit = 8,
): Promise<SubmissionActivity[]> {
  const { data: submissions, error } = await supabase
    .from('guest_list_submissions')
    .select('id, group_id, created_at, submitted_by_name, submitted_by_instagram, contact_email')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    throw error
  }

  const rows = (submissions ?? []) as SubmissionRow[]
  const groupIds = rows.map((row) => row.group_id).filter((id): id is string => Boolean(id))
  const namesByGroup = await loadNamesByGroup(supabase, groupIds)

  return createActivities(rows, namesByGroup)
}

export async function fetchSubmissionActivityById(
  supabase: SupabaseClient,
  submissionId: string,
): Promise<SubmissionActivity | null> {
  const { data: submission, error } = await supabase
    .from('guest_list_submissions')
    .select('id, group_id, created_at, submitted_by_name, submitted_by_instagram, contact_email')
    .eq('id', submissionId)
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!submission) {
    return null
  }

  const row = submission as SubmissionRow
  const namesByGroup = await loadNamesByGroup(
    supabase,
    row.group_id ? [row.group_id] : [],
  )

  return createActivities([row], namesByGroup)[0]
}

export async function fetchAdminGuestList(
  supabase: SupabaseClient,
): Promise<AdminGuestListItem[]> {
  const { data: groups, error: groupError } = await supabase
    .from('guest_list_group_summary')
    .select(
      [
        'group_id',
        'group_code',
        'lead_full_name',
        'lead_instagram',
        'created_at',
        'total_people',
        'group_status',
        'active_ticket_code',
        'submission_count',
      ].join(', '),
    )
    .order('created_at', { ascending: false })

  if (groupError) {
    throw groupError
  }

  const groupRows = (groups ?? []) as unknown as GroupSummaryRow[]

  const groupIds = groupRows.map((row) => row.group_id)

  if (!groupIds.length) {
    return []
  }

  const [submissionRes, ticketsRes] = await Promise.all([
    supabase
      .from('guest_list_submissions')
      .select('group_id, contact_email, created_at')
      .in('group_id', groupIds)
      .order('created_at', { ascending: false }),
    supabase
      .from('guest_list_tickets')
      .select('group_id, status, ticket_code, issued_at')
      .in('group_id', groupIds)
      .order('issued_at', { ascending: false }),
  ])

  if (submissionRes.error) {
    throw submissionRes.error
  }

  if (ticketsRes.error) {
    throw ticketsRes.error
  }

  const latestSubmissionByGroup = new Map<string, { email: string | null; createdAt: string | null }>()
  for (const row of submissionRes.data ?? []) {
    const typed = row as { group_id: string | null; contact_email: string | null; created_at: string | null }
    if (!typed.group_id || latestSubmissionByGroup.has(typed.group_id)) {
      continue
    }

    latestSubmissionByGroup.set(typed.group_id, {
      email: typed.contact_email,
      createdAt: typed.created_at,
    })
  }

  const latestTicketByGroup = new Map<string, { status: string | null; code: string | null }>()
  for (const row of ticketsRes.data ?? []) {
    const typed = row as { group_id: string | null; status: string | null; ticket_code: string | null }
    if (!typed.group_id || latestTicketByGroup.has(typed.group_id)) {
      continue
    }

    latestTicketByGroup.set(typed.group_id, {
      status: typed.status,
      code: typed.ticket_code,
    })
  }

  return groupRows.map((group) => {
    const latestSubmission = latestSubmissionByGroup.get(group.group_id)
    const latestTicket = latestTicketByGroup.get(group.group_id)

    return {
      groupId: group.group_id,
      groupCode: group.group_code,
      leadFullName: group.lead_full_name,
      leadInstagram: group.lead_instagram,
      createdAt: group.created_at,
      totalPeople: group.total_people ?? 0,
      groupStatus: group.group_status,
      activeTicketCode: group.active_ticket_code,
      submissionCount: group.submission_count ?? 0,
      contactEmail: latestSubmission?.email ?? null,
      latestSubmissionAt: latestSubmission?.createdAt ?? null,
      ticketStatus: latestTicket?.status ?? null,
      latestTicketCode: latestTicket?.code ?? group.active_ticket_code ?? null,
    }
  })
}

export async function fetchAdminGroupDetail(
  supabase: SupabaseClient,
  groupId: string,
): Promise<AdminGroupDetail | null> {
  const [groupRes, membersRes, submissionRes, ticketRes] = await Promise.all([
    supabase
      .from('guest_list_groups')
      .select(
        [
          'id',
          'group_code',
          'created_at',
          'status',
          'event_code',
          'lead_full_name',
          'lead_instagram',
          'lead_gender',
          'total_people',
        ].join(', '),
      )
      .eq('id', groupId)
      .maybeSingle(),
    supabase
      .from('guest_list_members')
      .select('id, full_name, instagram, gender, person_type, sort_order')
      .eq('group_id', groupId)
      .order('sort_order', { ascending: true }),
    supabase
      .from('guest_list_submissions')
      .select(
        [
          'id',
          'created_at',
          'contact_email',
          'submitted_by_name',
          'submitted_by_instagram',
          'submitted_by_gender',
          'status',
          'payment_screenshot_url',
          'payment_screenshot_path',
        ].join(', '),
      )
      .eq('group_id', groupId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('guest_list_tickets')
      .select(
        [
          'id',
          'ticket_code',
          'status',
          'qr_payload',
          'issued_at',
          'used_at',
          'last_scan_at',
          'last_scan_result',
          'scan_count',
        ].join(', '),
      )
      .eq('group_id', groupId)
      .order('issued_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  if (groupRes.error) {
    throw groupRes.error
  }

  if (membersRes.error) {
    throw membersRes.error
  }

  if (submissionRes.error) {
    throw submissionRes.error
  }

  if (ticketRes.error) {
    throw ticketRes.error
  }

  if (!groupRes.data) {
    return null
  }

  const groupData = groupRes.data as unknown as GroupDetailRow
  const memberData = (membersRes.data ?? []) as unknown as GroupMemberDetailRow[]
  const submissionData = submissionRes.data as unknown as GroupSubmissionDetailRow | null
  const ticketData = ticketRes.data as unknown as GroupTicketDetailRow | null

  return {
    id: groupData.id,
    groupCode: groupData.group_code,
    createdAt: groupData.created_at,
    status: groupData.status,
    eventCode: groupData.event_code,
    leadFullName: groupData.lead_full_name,
    leadInstagram: groupData.lead_instagram,
    leadGender: groupData.lead_gender,
    totalPeople: groupData.total_people ?? 0,
    members: memberData.map((member) => ({
      id: member.id,
      fullName: member.full_name,
      instagram: member.instagram,
      gender: member.gender,
      personType: member.person_type,
      sortOrder: member.sort_order,
    })),
    latestSubmission: submissionData
      ? {
          id: submissionData.id,
          createdAt: submissionData.created_at,
          contactEmail: submissionData.contact_email,
          submittedByName: submissionData.submitted_by_name,
          submittedByInstagram: submissionData.submitted_by_instagram,
          submittedByGender: submissionData.submitted_by_gender,
          status: submissionData.status,
          paymentScreenshotUrl: submissionData.payment_screenshot_url,
          paymentScreenshotPath: submissionData.payment_screenshot_path,
        }
      : null,
    latestTicket: ticketData
      ? {
          id: ticketData.id,
          ticketCode: ticketData.ticket_code,
          status: ticketData.status,
          qrPayload: ticketData.qr_payload,
          issuedAt: ticketData.issued_at,
          usedAt: ticketData.used_at,
          lastScanAt: ticketData.last_scan_at,
          lastScanResult: ticketData.last_scan_result,
          scanCount: ticketData.scan_count,
        }
      : null,
  }
}

export function subscribeAdminRealtime(
  supabase: SupabaseClient,
  onChange: () => void,
): RealtimeChannel {
  const channel = supabase.channel(`admin-live-${crypto.randomUUID()}`)

  const handler = () => {
    onChange()
  }

  channel
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'guest_list_submissions' },
      handler,
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'guest_list_groups' },
      handler,
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'guest_list_tickets' },
      handler,
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'guest_list_members' },
      handler,
    )
    .subscribe()

  return channel
}
