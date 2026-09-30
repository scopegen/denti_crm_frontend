import { useCallback, useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { Button } from '../../../components/Button'
import { ButtonRow } from '../../../components/ButtonRow'
import { Pill } from '../../../components/Pill'
import { ApiError } from '../../../lib/api'
import { formatDate, formatTime } from '../../../lib/date'
import { MESSAGE_LABEL, whatsappApi, type SentMessage, type ShareLink } from '../../../lib/whatsappApi'
import { useAuth } from '../../../state/AuthContext'
import type { PatientContext } from '../PatientDetail'

// Every WhatsApp message opened for this patient (Standard and Pro), newest first. Tap-to-send
// cannot tell whether a message was delivered, only that it was opened ready to send. A
// message with a document shows whether the patient opened its link; the owner or
// receptionist can stop a link, for example when it went to the wrong number.

function linkText(link: ShareLink, timeZone?: string): string {
  if (link.revokedAt) return `Link stopped on ${formatDate(link.revokedAt, timeZone)}`
  if (!link.active) return `Link expired on ${formatDate(link.expiresAt, timeZone)}`
  const opened =
    link.openCount === 0
      ? 'Not opened yet'
      : `Opened ${link.openCount === 1 ? 'once' : `${link.openCount} times`}, last on ${formatDate(link.lastOpenedAt!, timeZone)}`
  return `${opened} · works until ${formatDate(link.expiresAt, timeZone)}`
}

export function MessagesSection() {
  const { patient } = useOutletContext<PatientContext>()
  const { clinic, staff } = useAuth()
  const isAdmin = staff?.role === 'owner' || staff?.role === 'admin'
  const [messages, setMessages] = useState<SentMessage[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    whatsappApi
      .messages(patient.id)
      .then(setMessages)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load the messages.'))
  }, [patient.id])

  useEffect(() => {
    load()
  }, [load])

  async function stop(linkId: string) {
    setError(null)
    try {
      await whatsappApi.stopLink(linkId)
      load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not stop the link.')
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {!patient.whatsappConsent && (
        <p className="rounded-lg bg-warn-soft px-3.5 py-2.5 text-body text-warn">
          {patient.name} has not agreed to WhatsApp messages. Tick WhatsApp consent on their details to send them.
        </p>
      )}
      {error && <p className="rounded-lg bg-crit-soft px-3.5 py-2.5 text-body text-crit">{error}</p>}
      {messages && messages.length === 0 && <p className="text-body text-ink-soft">No WhatsApp messages yet.</p>}
      {messages && messages.length > 0 && (
        <ol className="flex flex-col divide-y divide-rule rounded-xl border border-rule bg-white shadow-sm">
          {messages.map((m) => (
            <li key={m.id} className="flex flex-col gap-1.5 px-4 py-3">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <span className="flex items-center gap-2 text-body font-medium text-ink">
                  {MESSAGE_LABEL[m.kind]}
                  {m.language === 'hi' && <Pill>Hindi</Pill>}
                </span>
                <span className="text-[12px] tabular-nums text-ink-faint">
                  {formatDate(m.createdAt, clinic?.timezone)} {formatTime(m.createdAt, clinic?.timezone)}
                  {m.sentBy ? ` · ${m.sentBy.name}` : ''}
                </span>
              </div>
              <p className="whitespace-pre-line break-words text-[13px] text-ink-soft">{m.body}</p>
              {m.link && (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className={`text-[12px] ${m.link.active ? 'text-ok' : 'text-ink-faint'}`}>{linkText(m.link, clinic?.timezone)}</span>
                  {isAdmin && m.link.active && (
                    <ButtonRow>
                      <Button variant="ghost" className="!px-2.5 !py-1 text-[13px]" onClick={() => stop(m.link!.id)}>
                        Stop link
                      </Button>
                    </ButtonRow>
                  )}
                </div>
              )}
            </li>
          ))}
        </ol>
      )}
      <p className="text-[12px] text-ink-faint">
        Messages open in WhatsApp ready to send from the clinic's number. Denti cannot see whether they were sent or read.
      </p>
    </div>
  )
}
