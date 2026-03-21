import { Resend } from 'resend'

type PaymentMode = 'pay_self' | 'pay_group' | 'group_paid'

type GroupMemberPayload = {
  name?: string
  email?: string
  instagram?: string
  gender?: string
}

type SendTicketEmailPayload = {
  email: string
  name: string
  qrCodeUrl: string
  ticketCode: string
  paymentMode: PaymentMode
  groupMembers?: GroupMemberPayload[]
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function paymentStatusLabel(paymentMode: PaymentMode) {
  if (paymentMode === 'pay_self') {
    return 'Paid for myself'
  }

  if (paymentMode === 'pay_group') {
    return 'Paid for group'
  }

  return 'Covered by group'
}

function isPaymentMode(value: unknown): value is PaymentMode {
  return value === 'pay_self' || value === 'pay_group' || value === 'group_paid'
}

function toEmbeddedQrImageSource(qrCodeUrl: string) {
  const candidate = qrCodeUrl.trim()
  if (!candidate) {
    return ''
  }

  const looksLikeImage =
    /^data:image\//i.test(candidate) ||
    /\.(png|jpe?g|gif|webp|svg)(\?.*)?$/i.test(candidate)

  if (looksLikeImage) {
    return candidate
  }

  return `https://api.qrserver.com/v1/create-qr-code/?size=460x460&margin=8&data=${encodeURIComponent(candidate)}`
}

function buildPremiumTicketEmailHtml(data: SendTicketEmailPayload) {
  const safeName = escapeHtml(data.name)
  const safeTicketCode = escapeHtml(data.ticketCode)
  const safePaymentStatus = escapeHtml(paymentStatusLabel(data.paymentMode))
  const qrImageSource = toEmbeddedQrImageSource(data.qrCodeUrl)
  const safeQrCodeUrl = escapeHtml(qrImageSource)

  const groupRows = (data.groupMembers ?? [])
    .map((member) => {
      const memberName = escapeHtml(member.name?.trim() || 'Guest member')
      const memberInstagram = member.instagram?.trim()
      const memberGender = member.gender?.trim()
      const suffix: string[] = []

      if (memberInstagram) {
        suffix.push(`@${escapeHtml(memberInstagram.replace(/^@+/, ''))}`)
      }

      if (memberGender) {
        suffix.push(escapeHtml(memberGender))
      }

      const detail = suffix.length ? ` - ${suffix.join(' • ')}` : ''
      return `<li style="margin:0 0 8px 0;">${memberName}${detail}</li>`
    })
    .join('')

  const groupSection = groupRows
    ? `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:28px;border-radius:14px;border:1px solid #4d2d24;background:rgba(24,11,12,0.84);">
        <tr>
          <td style="padding:18px 20px;">
            <p style="margin:0 0 12px 0;color:#d8c2b0;font-size:12px;letter-spacing:0.14em;text-transform:uppercase;">Group on your signup</p>
            <ul style="margin:0;padding-left:18px;color:#eadbc8;font-size:15px;line-height:1.65;">
              ${groupRows}
            </ul>
          </td>
        </tr>
      </table>
    `
    : ''

  return `
    <!doctype html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta http-equiv="x-ua-compatible" content="ie=edge" />
        <style>
          .email-body-text {
            font-size: 16px !important;
            line-height: 1.72 !important;
          }

          @media only screen and (max-width: 600px) {
            .outer-pad {
              padding: 24px 12px !important;
            }
            .inner-pad {
              padding: 32px 22px 28px 22px !important;
            }
            .top-label {
              font-size: 12px !important;
              letter-spacing: 0.16em !important;
            }
            .hero-heading {
              font-size: 34px !important;
              line-height: 1.16 !important;
            }
            .email-body-text {
              font-size: 17px !important;
              line-height: 1.76 !important;
            }
            .qr-container {
              padding: 24px 16px !important;
            }
            .qr-image {
              max-width: 270px !important;
            }
          }
        </style>
      </head>
      <body style="margin:0;padding:0;background:#130608;color:#eadbc8;font-family:ui-serif,Georgia,Cambria,'Times New Roman',Times,serif;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:
          radial-gradient(980px 430px at 50% -10%, rgba(146, 34, 50, 0.35), rgba(19,6,8,0)),
          radial-gradient(700px 280px at 8% 94%, rgba(102, 24, 38, 0.3), rgba(19,6,8,0)),
          #130608;">
          <tr>
            <td align="center" class="outer-pad" style="padding:36px 14px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;border-radius:22px;border:1px solid #4d2723;background:linear-gradient(162deg, rgba(29,13,14,0.95), rgba(18,7,10,0.93));box-shadow:0 0 0 1px rgba(245,237,228,0.04) inset, 0 0 52px rgba(119,31,45,0.32);">
                <tr>
                  <td class="inner-pad" style="padding:36px 30px 30px 30px;">
                    <p class="top-label" style="margin:0 0 12px 0;color:#d8c2b0;font-size:12px;letter-spacing:0.16em;text-transform:uppercase;">Afterlife Club 2026</p>
                    <h1 class="hero-heading" style="margin:0 0 22px 0;font-size:38px;line-height:1.14;font-weight:700;color:#f5ede4;">
                      You&#39;re on the guest list ✨
                    </h1>
                    <p class="email-body-text" style="margin:0 0 18px 0;color:#eadbc8;font-size:16px;line-height:1.72;">Dear ${safeName},</p>
                    <p class="email-body-text" style="margin:0 0 16px 0;color:#eadbc8;font-size:16px;line-height:1.72;">
                      You&#39;ve been added to the guest list for Afterlife Club 2026.
                    </p>
                    <p class="email-body-text" style="margin:0 0 26px 0;color:#eadbc8;font-size:16px;line-height:1.72;">
                      Screenshot and save this QR code &mdash; it will be used for entry at the gate on the day of the event.
                    </p>

                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-radius:16px;border:1px solid #5f392b;background:rgba(22,10,11,0.88);">
                      <tr>
                        <td align="center" class="qr-container" style="padding:26px 20px 24px 20px;">
                          <img src="${safeQrCodeUrl}" alt="Your QR code for event entry" width="280" height="280" class="qr-image" style="display:block;border:0;outline:none;text-decoration:none;width:100%;max-width:280px;height:auto;border-radius:12px;background:#ffffff;padding:12px;box-sizing:border-box;" />
                        </td>
                      </tr>
                    </table>

                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:22px;border-collapse:collapse;">
                      <tr>
                        <td style="padding:8px 0;color:#b89463;font-size:13px;letter-spacing:0.1em;text-transform:uppercase;">Your ticket</td>
                        <td align="right" style="padding:8px 0;color:#f5ede4;font-size:16px;font-weight:600;">${safeTicketCode}</td>
                      </tr>
                      <tr>
                        <td style="padding:8px 0;color:#b89463;font-size:13px;letter-spacing:0.1em;text-transform:uppercase;">Payment Status</td>
                        <td align="right" style="padding:8px 0;color:#f5ede4;font-size:15px;font-weight:600;">${safePaymentStatus}</td>
                      </tr>
                    </table>
                    <p style="margin:12px 0 0 0;color:#d8c2b0;font-size:13px;line-height:1.66;">
                      Payment Status: ${safePaymentStatus}
                    </p>

                    ${groupSection}

                    <p style="margin:24px 0 0 0;color:#d8c2b0;font-size:12px;line-height:1.66;">
                      This confirmation is personal to you and linked to your ticket QR.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `
}

export default async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  const resendApiKey = process.env.RESEND_API_KEY
  if (!resendApiKey) {
    return Response.json({ error: 'RESEND_API_KEY is not configured.' }, { status: 500 })
  }

  let body: SendTicketEmailPayload
  try {
    body = (await req.json()) as SendTicketEmailPayload
  } catch {
    return Response.json({ error: 'Invalid JSON payload.' }, { status: 400 })
  }

  if (!body.email || !body.name || !body.qrCodeUrl || !body.ticketCode || !body.paymentMode) {
    return Response.json(
      { error: 'Missing required fields: email, name, qrCodeUrl, ticketCode, paymentMode.' },
      { status: 400 },
    )
  }
  if (!isPaymentMode(body.paymentMode)) {
    return Response.json(
      { error: 'Invalid paymentMode. Expected pay_self, pay_group, or group_paid.' },
      { status: 400 },
    )
  }

  const resend = new Resend(process.env.RESEND_API_KEY)
  const sendResult = await resend.emails.send({
    from: 'tickets@afterlife2026.online',
    to: [body.email],
    subject: "You're on the guest list ✨ | Afterlife Club 2026",
    html: buildPremiumTicketEmailHtml({
      ...body,
      groupMembers: Array.isArray(body.groupMembers) ? body.groupMembers : [],
    }),
  })

  if (sendResult.error) {
    return Response.json(
      { error: sendResult.error.message || 'Failed to send ticket email.' },
      { status: 502 },
    )
  }

  return Response.json({
    queued: true,
    provider: 'resend',
    messageId: sendResult.data?.id ?? null,
  })
}
