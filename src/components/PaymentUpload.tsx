import { useMemo, useState } from 'react'

import { getSupabaseClient } from '@/lib/supabase'
import type { UploadInfo } from '@/types/guest'

type PaymentUploadProps = {
  value: UploadInfo | null
  onUploaded: (upload: UploadInfo | null) => void
}

function getFileExtension(fileName: string) {
  const fileParts = fileName.split('.')
  return fileParts.length > 1 ? fileParts.at(-1) : 'jpg'
}

export function PaymentUpload({ value, onUploaded }: PaymentUploadProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(value?.url ?? null)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState('')

  const hasUpload = useMemo(() => Boolean(value?.url), [value])

  const handleFileSelect = async (file: File | null) => {
    if (!file) {
      return
    }

    setError('')
    setIsUploading(true)

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
