import { useCallback, useEffect, useRef, useState } from 'react'

import { Link, createFileRoute } from '@tanstack/react-router'
import type { Html5Qrcode, Html5QrcodeCameraScanConfig } from 'html5-qrcode'

import { ScannerResultCard } from '@/components/ScannerResultCard'
import { getSupabaseClient } from '@/lib/supabase'
import type { ScanOutcome } from '@/types/guest'

export const Route = createFileRoute('/gate-scanner')({
  component: GateScannerPage,
})

function parseTicketCode(rawValue: string) {
  const raw = rawValue.trim()

  if (!raw) {
    return ''
  }

  const ticketCode = raw.includes('/')
    ? raw.split('/').pop()
    : raw

  return ticketCode?.trim() ?? ''
}

function normalizeStatus(value: unknown): ScanOutcome['status'] {
  if (
    value === 'accepted'
    || value === 'already_used'
    || value === 'inactive'
    || value === 'error'
  ) {
    return value
  }

  return 'invalid'
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

    const parsedTicketCode = parseTicketCode(rawValue)

    if (!parsedTicketCode) {
      setResult({
        status: 'invalid',
        message: 'Ticket code is empty after parsing.',
      })
      return
    }

    lockRef.current = true
    setError('')
    setIsConsuming(true)

    try {
      const supabase = getSupabaseClient()
      const { data, error } = await supabase.rpc('consume_guest_ticket_once', {
        p_ticket_code: parsedTicketCode,
        p_scanned_by: 'gate',
        p_device_info: 'mobile',
      })

      console.log('SCAN DATA:', data)
      console.log('RPC RESPONSE:', data)
      console.log('RPC ERROR:', error)

      if (error) {
        setResult({
          status: 'error',
          message: error.message || 'Scan failed',
        })
        return
      }

      if (!data || typeof data !== 'object') {
        setResult({
          status: 'error',
          message: 'Invalid response from server',
        })
        return
      }

      const payload = data as Record<string, unknown>

      if (payload.ok === true) {
        const members = Array.isArray(payload.members) ? payload.members : []
        const leadGuest = typeof payload.lead_full_name === 'string'
          ? payload.lead_full_name
          : ''

        setResult({
          status: 'accepted',
          message: 'Entry approved.',
          leadGuest,
          members: members as ScanOutcome['members'],
          membersDebug: JSON.stringify(payload.members),
        })
      } else {
        setResult({
          status: normalizeStatus(payload.result),
          message:
            typeof payload.message === 'string' && payload.message.trim()
              ? payload.message
              : 'Ticket invalid',
        })
      }
    } catch (consumeErr) {
      setResult({
        status: 'error',
        message:
        consumeErr instanceof Error
          ? consumeErr.message
          : 'Ticket consumption failed.',
      })
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
