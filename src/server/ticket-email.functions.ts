import { createServerFn } from '@tanstack/react-start'

type TicketEmailPayload = {
  eventName: string
  ticketCode: string
  recipientEmail: string
  qrPayload: string
}

export const sendTicketEmailPlaceholder = createServerFn({ method: 'POST' })
  .inputValidator((data: TicketEmailPayload) => data)
  .handler(async ({ data }) => {
    // Placeholder for future provider integration (Resend, Postmark, etc.)
    console.info('Ticket email placeholder called', {
      eventName: data.eventName,
      ticketCode: data.ticketCode,
      recipientEmail: data.recipientEmail,
      qrPayloadLength: data.qrPayload.length,
    })

    return {
      queued: false,
      provider: null,
      message: 'Email provider not configured yet.',
    }
  })
