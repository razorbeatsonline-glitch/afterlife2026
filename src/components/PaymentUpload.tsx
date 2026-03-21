import { useMemo, useState } from 'react'

import { getSupabaseClient } from '@/lib/supabase'
import type { Gender, UploadInfo } from '@/types/guest'

type PaymentMode = 'pay_self' | 'pay_group' | 'group_paid' | ''

type PaymentUploadProps = {
  leadGender: Gender | ''
  paymentMode: PaymentMode
  totalAmount: number
  value: UploadInfo | null
  onUploaded: (upload: UploadInfo | null) => void
  onUploadStatusChange?: (uploading: boolean) => void
}

function getFileExtension(fileName: string) {
  const fileParts = fileName.split('.')
  return fileParts.length > 1 ? fileParts.at(-1) : 'jpg'
}

export function PaymentUpload({
  leadGender,
  paymentMode,
  totalAmount,
  value,
  onUploaded,
  onUploadStatusChange,
}: PaymentUploadProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(value?.url ?? null)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState('')

  const hasUpload = useMemo(() => Boolean(value?.url), [value])
  const leadPayment = useMemo(() => (leadGender === 'female' ? 1500 : 2000), [leadGender])
  const shouldShowPricing = paymentMode !== 'group_paid'
  const paymentHeading = useMemo(() => {
    if (paymentMode === 'pay_group') {
      return 'You are paying for your group'
    }

    if (paymentMode === 'group_paid') {
      return 'Your group has already paid'
    }

    return 'You are paying for yourself'
  }, [paymentMode])

  const handleFileSelect = async (file: File | null) => {
    if (!file) {
      return
    }

    setError('')
    setIsUploading(true)
    onUploadStatusChange?.(true)

    try {
      const supabase = getSupabaseClient()
      const extension = getFileExtension(file.name)
      const uploadPath = `proofs/${Date.now()}-${crypto.randomUUID()}.${extension}`
      const { error: uploadError } = await supabase.storage
        .from('afterlife-payment-proofs')
        .upload(uploadPath, file, {
          contentType: file.type,
          upsert: false,
        })

      if (uploadError) {
        throw uploadError
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from('afterlife-payment-proofs').getPublicUrl(uploadPath)

      setPreviewUrl(publicUrl)
      onUploaded({
        url: publicUrl,
        path: uploadPath,
      })
    } catch (uploadErr) {
      onUploaded(null)
      setPreviewUrl(null)
      setError(
        uploadErr instanceof Error
          ? uploadErr.message
          : 'Payment upload failed. Please retry.',
      )
    } finally {
      setIsUploading(false)
      onUploadStatusChange?.(false)
    }
  }

  return (
    <article className="glass-card animate-rise space-y-4">
      <div className="space-y-1">
        <h3 className="text-base font-semibold text-white">Payment Upload</h3>
        <p className="text-xs text-zinc-300">
          Upload payment screenshot (required).
        </p>
      </div>

      <section className="space-y-3 rounded-2xl border border-red-300/35 bg-[linear-gradient(150deg,rgba(190,18,44,0.34),rgba(15,15,17,0.9))] p-4 shadow-[0_16px_35px_rgba(0,0,0,0.45),0_0_24px_rgba(220,38,38,0.2)] sm:p-5">
        <h4 className="text-sm font-semibold uppercase tracking-[0.16em] text-red-100">
          Payment Details
        </h4>
        <div className="rounded-xl border border-red-200/20 bg-black/35 px-3 py-2.5">
          <p className="text-sm text-red-50">{paymentHeading}</p>
          {shouldShowPricing ? (
            <>
              <p className="mt-2 text-[0.69rem] uppercase tracking-[0.16em] text-red-200/80">
                Total
              </p>
              <p className="mt-1 text-lg font-semibold text-white sm:text-xl">
                Rs {totalAmount || leadPayment}
              </p>
            </>
          ) : null}
        </div>
        <dl className="space-y-2.5">
          <div className="rounded-xl border border-white/12 bg-black/30 px-3 py-2.5">
            <dt className="text-[0.69rem] uppercase tracking-[0.16em] text-zinc-300">
              Account Number
            </dt>
            <dd className="mt-1 text-base font-medium tracking-[0.04em] text-white">
              0896753001
            </dd>
          </div>
          <div className="rounded-xl border border-white/12 bg-black/30 px-3 py-2.5">
            <dt className="text-[0.69rem] uppercase tracking-[0.16em] text-zinc-300">
              Bank
            </dt>
            <dd className="mt-1 text-base font-medium text-white">
              Dubai Islamic Bank
            </dd>
          </div>
          <div className="rounded-xl border border-white/12 bg-black/30 px-3 py-2.5">
            <dt className="text-[0.69rem] uppercase tracking-[0.16em] text-zinc-300">
              Account Name
            </dt>
            <dd className="mt-1 text-base font-medium text-white">
              Raza Abbas Zaidi
            </dd>
          </div>
        </dl>
      </section>

      <label className="field-label" htmlFor="payment-proof">
        Screenshot or receipt image
      </label>
      <input
        id="payment-proof"
        type="file"
        accept="image/*"
        className="field-input file:mr-4 file:rounded-full file:border-0 file:bg-[rgba(255,56,56,0.2)] file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-red-200"
        onChange={(event) => {
          const [selected] = Array.from(event.currentTarget.files ?? [])
          void handleFileSelect(selected ?? null)
        }}
      />

      {isUploading ? <p className="text-sm text-red-100">Uploading...</p> : null}
      {error ? <p className="error-text">{error}</p> : null}
      {!error && hasUpload ? (
        <p className="text-xs text-emerald-300">Upload complete.</p>
      ) : null}

      {previewUrl ? (
        <img
          src={previewUrl}
          alt="Payment proof preview"
          className="h-48 w-full rounded-xl object-cover ring-1 ring-white/15"
        />
      ) : null}
    </article>
  )
}
