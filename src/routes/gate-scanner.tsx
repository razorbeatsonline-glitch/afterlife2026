import { useCallback, useEffect, useRef, useState } from 'react'

import { Link, createFileRoute } from '@tanstack/react-router'
import type { PostgrestError } from '@supabase/supabase-js'
import type { Html5Qrcode, Html5QrcodeCameraScanConfig } from 'html5-qrcode'

import { ScannerResultCard } from '@/components/ScannerResultCard'
import { getSupabaseClient } from '@/lib/supabase'
import type { ScanOutcome } from '@/types/guest'

export const Route = createFileRoute('/gate-scanner')({
  component: GateScannerPage,
})

type RpcArgs = Record<string, unknown>

function readField<T>(record: Record<string, unknown>, keys: string[], fallback: T): T {
  for (const key of keys) {
    if (key in record) {
      return record[key] as T
    }
  }

  return fallback
}

function parseScanResult(data: unknown): ScanOutcome {
  const row = (Array.isArray(data) ? data[0] : data) as
    | Record<string, unknown>
    | undefined

  if (!row) {
    return {
      status: 'invalid',
      message: 'No ticket data returned.',
    }
  }

  const statusRaw = String(
    readField(row, ['status', 'scan_status', 'result_status'], 'invalid'),
  ).toLowerCase()
  const status: ScanOutcome['status'] =
    statusRaw === 'accepted' ||
    statusRaw === 'already_used' ||
    statusRaw === 'inactive'
      ? statusRaw
      : 'invalid'

  const membersRaw = readField<unknown>(row, ['members', 'member_list'], [])
  const members = Array.isArray(membersRaw)
    ? membersRaw.map((member) => {
        const payload = member as Record<string, unknown>
        return {
          fullName: readField<string>(payload, ['full_name', 'fullName'], ''),
          instagram: readField<string>(payload, ['instagram', 'instagram_username'], ''),
          gender: readField<string>(payload, ['gender'], ''),
          personType: readField<string>(payload, ['person_type', 'personType'], ''),
        }
      })
    : []

  return {
    status,
    message: readField<string>(
      row,
      ['message', 'status_message'],
      status === 'accepted' ? 'Entry approved.' : 'Ticket could not be consumed.',
    ),
    ticketCode: readField<string>(row, ['ticket_code', 'ticketCode'], ''),
    leadGuest: readField<string>(row, ['lead_guest', 'lead_name', 'lead_full_name'], ''),
    leadInstagram: readField<string>(
      row,
      ['lead_instagram', 'lead_instagram_username'],
      '',
    ),
    leadGender: readField<string>(row, ['lead_gender'], ''),
    totalPeople: Number(readField<number>(row, ['total_people'], 0)),
    groupCode: readField<string | null>(row, ['group_code'], null),
    members,
  }
}

function needsSignatureFallback(error: PostgrestError) {
  return error.code === 'PGRST202' || error.message.includes('function public.consume_guest_ticket_once')
}

async function consumeTicketViaRpc(rawInput: string) {
  const supabase = getSupabaseClient()

  const candidateArgs: RpcArgs[] = [
    { p_qr_payload: rawInput },
    { p_ticket_code: rawInput },
    { p_qr_or_ticket: rawInput },
    { qr_payload: rawInput },
    { ticket_code: rawInput },
    { code: rawInput },
  ]

  let lastError: PostgrestError | null = null

  for (const args of candidateArgs) {
    const { data, error } = await supabase.rpc('consume_guest_ticket_once', args)

    if (!error) {
      return data
    }

    if (needsSignatureFallback(error)) {
      lastError = error
      continue
    }

    throw error
  }

  if (lastError) {
    throw lastError
  }

  throw new Error('Could not consume ticket.')
}

function GateScannerPage() {
  const [manualInput, setManualInput] = useState('')
  const [result, setResult] = useState<ScanOutcome | null>(null)
  const [error, setError] = useState('')
  const [isConsuming, setIsConsuming] = useState(false)
  const [isScannerOpen, setIsScannerOpen] = useState(false)
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const lockRef = useRef(false)

  const consumeTicket = useCallback(async (rawValue: string) => {
    if (!rawValue || isConsuming || lockRef.current) {
      return
    }

    lockRef.current = true
    setError('')
    setIsConsuming(true)

    try {
      const data = await consumeTicketViaRpc(rawValue.trim())
      setResult(parseScanResult(data))
    } catch (consumeErr) {
      setResult(null)
      setError(
        consumeErr instanceof Error
          ? consumeErr.message
          : 'Ticket consumption failed.',
      )
    } finally {
      setIsConsuming(false)
      lockRef.current = false
    }
  }, [isConsuming])

  const stopScanner = useCallback(async () => {
    if (!scannerRef.current) {
      return
    }

    try {
      await scannerRef.current.stop()
    } catch {
      // Scanner might already be stopped.
    }

    try {
      await scannerRef.current.clear()
    } catch {
      // Scanner surface might already be cleared.
    }

    scannerRef.current = null
  }, [])

  const startScanner = useCallback(async () => {
    if (typeof window === 'undefined' || scannerRef.current) {
      return
    }

    setResult(null)
    setError('')

    try {
      const module = await import('html5-qrcode')
      const Html5Qrcode = module.Html5Qrcode
      const scanner = new Html5Qrcode('afterlife-scanner-reader')
      scannerRef.current = scanner

      const scannerConfig: Html5QrcodeCameraScanConfig = {
        fps: 10,
        qrbox: { width: 220, height: 220 },
      }

      await scanner.start(
        { facingMode: 'environment' },
        scannerConfig,
        (decodedText) => {
          void consumeTicket(decodedText)
          void stopScanner()
          setIsScannerOpen(false)
        },
        () => {
          // Frequent decode miss errors are expected and ignored.
        },
      )
    } catch (scannerErr) {
      setIsScannerOpen(false)
      setError(
        scannerErr instanceof Error
          ? scannerErr.message
          : 'Could not start camera scanner.',
      )
      await stopScanner()
    }
  }, [consumeTicket, stopScanner])

  useEffect(() => {
    if (isScannerOpen) {
      void startScanner()
      return
    }

    void stopScanner()
  }, [isScannerOpen, startScanner, stopScanner])

  useEffect(() => {
    return () => {
      void stopScanner()
    }
  }, [stopScanner])

  return (
    <main className="afterlife-bg min-h-screen px-4 py-8 sm:px-6">
      <div className="mx-auto w-full max-w-2xl space-y-6">
        <header className="glass-card animate-rise space-y-3 text-center">
          <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
            Afterlife Gate Scanner
          </h1>
          <p className="text-sm uppercase tracking-[0.3em] text-red-200">
            Scan QR or enter ticket code
          </p>
          <Link to="/" className="btn-outline mx-auto inline-block">
            Back To Signup
          </Link>
        </header>

        <section className="glass-card animate-rise space-y-4">
          <div className="grid gap-3">
            <button
              type="button"
              className="btn-primary"
              onClick={() => setIsScannerOpen((current) => !current)}
            >
              {isScannerOpen ? 'Stop Camera Scanner' : 'Start Camera Scanner'}
            </button>

            <div
              id="afterlife-scanner-reader"
              className="min-h-52 rounded-xl border border-white/15 bg-black/40 p-2"
            />
          </div>

          <div className="space-y-2">
            <label className="field-label" htmlFor="manual-ticket-input">
              Manual ticket code fallback
            </label>
            <input
              id="manual-ticket-input"
              className="field-input"
              value={manualInput}
              onChange={(event) => setManualInput(event.currentTarget.value)}
              placeholder="Enter ticket code"
            />
            <button
              type="button"
              className="btn-outline w-full"
              onClick={() => void consumeTicket(manualInput)}
              disabled={isConsuming}
            >
              {isConsuming ? 'Checking...' : 'Validate Ticket'}
            </button>
          </div>

          {error ? <p className="error-text">{error}</p> : null}
        </section>

        {result ? <ScannerResultCard result={result} /> : null}
      </div>
    </main>
  )
}
