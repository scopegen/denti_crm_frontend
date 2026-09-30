import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { ApiError } from '../lib/api'
import { settingsApi } from '../lib/settingsApi'
import type { Staff } from '../types/auth'
import { Button } from './Button'
import { ButtonRow } from './ButtonRow'
import { SignaturePad } from './SignaturePad'

// A doctor's signature, printed on their prescriptions. Upload a photo of it signed on
// white paper, or draw it. Either way it is cleaned to a see through background.

const MAX_BYTES = 5 * 1024 * 1024

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('That file could not be read.'))
    reader.readAsDataURL(file)
  })
}

export function SignatureSection({ person, onChange }: { person: Staff; onChange: (updated: Staff) => void }) {
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [drawing, setDrawing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Bumped after each save, so the new image is fetched.
  const [version, setVersion] = useState(0)
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!person.hasSignature) {
      setImageUrl(null)
      return
    }
    let url: string | null = null
    let cancelled = false
    settingsApi
      .signatureImage(person.id)
      .then((blob) => {
        if (cancelled) return
        url = URL.createObjectURL(blob)
        setImageUrl(url)
      })
      .catch(() => !cancelled && setImageUrl(null))
    return () => {
      cancelled = true
      if (url) URL.revokeObjectURL(url)
    }
  }, [person.id, person.hasSignature, version])

  async function save(dataUrl: string) {
    setSaving(true)
    setError(null)
    try {
      onChange(await settingsApi.setSignature(person.id, dataUrl))
      setVersion((v) => v + 1)
      setDrawing(false)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save the signature.')
    } finally {
      setSaving(false)
    }
  }

  async function upload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (file.size > MAX_BYTES) {
      setError('Use an image smaller than 5 MB.')
      return
    }
    try {
      await save(await readAsDataUrl(file))
    } catch {
      setError('That file could not be read. Use a PNG or JPG.')
    }
  }

  async function remove() {
    setSaving(true)
    setError(null)
    try {
      onChange(await settingsApi.removeSignature(person.id))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not remove the signature.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-rule bg-paper-raised/50 p-4">
      <div className="flex flex-col gap-0.5">
        <span className="text-body font-medium text-ink">Signature</span>
        <span className="text-[13px] text-ink-soft">
          Printed on {person.name}'s prescriptions. Sign on plain white paper and upload a photo, or draw it here.
        </span>
      </div>

      {drawing ? (
        <SignaturePad onSave={save} onCancel={() => setDrawing(false)} saving={saving} />
      ) : (
        <>
          {person.hasSignature ? (
            <div className="flex h-24 items-center justify-center rounded-lg border border-dashed border-rule bg-white p-3">
              {imageUrl && <img src={imageUrl} alt={`${person.name}'s signature`} className="max-h-full max-w-full object-contain" />}
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-rule bg-white px-3.5 py-6 text-center text-body text-ink-faint">
              No signature yet. Prescriptions print without one.
            </p>
          )}
          <input ref={fileInput} type="file" accept="image/png,image/jpeg" className="hidden" onChange={upload} />
          <ButtonRow>
            {person.hasSignature && (
              <Button variant="ghost" onClick={remove} disabled={saving}>
                Remove
              </Button>
            )}
            <Button variant="secondary" onClick={() => fileInput.current?.click()} disabled={saving}>
              Upload a photo
            </Button>
            <Button variant="tint" onClick={() => setDrawing(true)} disabled={saving}>
              {person.hasSignature ? 'Draw again' : 'Draw signature'}
            </Button>
          </ButtonRow>
        </>
      )}
      {error && <p className="rounded-lg bg-crit-soft px-3.5 py-2.5 text-body text-crit">{error}</p>}
    </div>
  )
}
