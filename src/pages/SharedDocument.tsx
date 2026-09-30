import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Download, Eye, FileText } from 'lucide-react'
import { ButtonRow } from '../components/ButtonRow'
import { ApiError, apiUrl } from '../lib/api'
import { formatDate } from '../lib/date'
import { whatsappApi, type SharedDocument as Shared } from '../lib/whatsappApi'
import { useAuth } from '../state/AuthContext'

// A document the clinic sent on WhatsApp, at denti.in/<clinic>/d/<token>. The patient opens it
// without signing in. The same card as the sign in page, with the clinic's name at the top.

const KIND_WORD: Record<Shared['kind'], string> = { prescription: 'prescription', invoice: 'invoice', estimate: 'treatment estimate' }

const linkButton =
  'inline-flex items-center gap-1.5 rounded-lg text-body font-medium transition-all duration-150 px-5 py-2.5 ' +
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2'

export function SharedDocument() {
  const { clinicSlug } = useAuth()
  const token = useParams().token ?? ''
  const [doc, setDoc] = useState<Shared | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    whatsappApi
      .sharedDocument(clinicSlug, token)
      .then(setDoc)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not open this link. Please try again.'))
  }, [clinicSlug, token])

  const pdf = apiUrl(`/public/${clinicSlug}/documents/${token}/pdf`)

  return (
    <div className="flex min-h-svh items-center justify-center px-6">
      <div className="flex w-full max-w-sm flex-col gap-5 rounded-xl border border-rule bg-white p-6 shadow-sm">
        <div className="flex flex-col items-center gap-2 pb-1 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-tint text-accent-deep">
            <FileText size={22} />
          </span>
          {doc && <span className="text-subheading font-medium text-ink">{doc.clinicName}</span>}
          {doc && (
            <h1 className="text-body font-normal text-ink-soft">
              {doc.title} · {doc.dateText}
            </h1>
          )}
        </div>
        {!doc && !error && <p className="text-center text-body text-ink-soft">Opening…</p>}
        {error && <p className="rounded-lg bg-crit-soft px-3.5 py-2.5 text-body text-crit">{error}</p>}
        {doc && (
          <>
            <p className="text-center text-body text-ink-soft">
              Here is your {KIND_WORD[doc.kind]}. This link works until {formatDate(doc.expiresAt)}.
            </p>
            <ButtonRow>
              <a href={`${pdf}?download=true`} className={`${linkButton} text-ink-soft hover:bg-paper-raised hover:text-ink`}>
                <Download size={15} /> Download
              </a>
              <a href={pdf} target="_blank" rel="noreferrer" className={`${linkButton} bg-accent text-white hover:bg-accent-hover`}>
                <Eye size={15} /> View PDF
              </a>
            </ButtonRow>
          </>
        )}
        <p className="text-center text-[11px] text-ink-faint">Sent securely with Denti. Please do not forward this link.</p>
      </div>
    </div>
  )
}
