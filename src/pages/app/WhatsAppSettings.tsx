import { useEffect, useState, type SubmitEvent } from 'react'
import { BackTitle } from '../../components/BackTitle'
import { Button } from '../../components/Button'
import { ButtonRow } from '../../components/ButtonRow'
import { Field, SelectField, TextareaField } from '../../components/Field'
import { Pill } from '../../components/Pill'
import { ApiError } from '../../lib/api'
import { clinicPath } from '../../lib/clinic'
import {
  LANGUAGE_LABEL,
  MESSAGE_LABEL,
  whatsappApi,
  type Language,
  type MessageKind,
  type MessageTemplate,
  type WhatsAppSettings as Settings,
} from '../../lib/whatsappApi'
import { useAuth } from '../../state/AuthContext'

// Settings, WhatsApp (Standard and Pro; owner and receptionist): the language messages open
// in, the Google review link, and the clinic's own wording for each message in English and
// Hindi. Messages open in the clinic's own WhatsApp, ready to send.

const LANGUAGE_OPTIONS = [LANGUAGE_LABEL.en, LANGUAGE_LABEL.hi]

const WHEN_USED: Record<MessageKind, string> = {
  visit_reminder: 'From an expected visit on Today or Follow ups.',
  call_reminder: 'From a call to make, when the patient does not pick up.',
  general: 'From the WhatsApp button on the patient page.',
  prescription: 'From a prescription. Carries a link to the PDF.',
  invoice: 'From an invoice on the bill. Carries a link to the PDF.',
  estimate: 'From a treatment estimate. Carries a link to the PDF.',
  review_request: 'From a finished treatment. Carries your Google review link.',
  lab_ready: 'From lab work that has come back.',
}

function sampleValues(clinicName: string, reviewUrl: string | null): Record<string, string> {
  return {
    name: 'Asha',
    clinic: clinicName,
    date: '5 Oct 2026 at 11:30 AM',
    reason: 'Root canal sitting 2',
    doctor: 'Dr Rohan Mehta',
    link: `${window.location.origin}/your-clinic/d/Xy7Qp`,
    number: 'SMILE/26-27/0001',
    amount: '₹6,500',
    valid_until: '30 Oct 2026',
    treatment: 'root canal treatment',
    review_link: reviewUrl || 'https://g.page/r/your-clinic/review',
  }
}

function preview(body: string, values: Record<string, string>): string {
  return body.replace(/\{(\w+)\}/g, (whole, key: string) => values[key] ?? whole)
}

export function WhatsAppSettings() {
  const { clinic, clinicSlug } = useAuth()
  const [settings, setSettings] = useState<Settings | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    whatsappApi
      .settings()
      .then(setSettings)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load the WhatsApp settings.'))
  }, [])

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-10">
      <div className="flex flex-col gap-1">
        <BackTitle to={clinicPath(clinicSlug, 'settings')} label="Back to settings">
          WhatsApp
        </BackTitle>
        <p className="text-ink-soft">
          Tapping a WhatsApp button opens WhatsApp on your phone or computer with the message written. You press send, so it goes from the
          clinic's own number. Only patients who agreed to WhatsApp messages can be sent one.
        </p>
      </div>
      {error && <p className="rounded-lg bg-crit-soft px-3.5 py-2.5 text-body text-crit">{error}</p>}
      {settings && (
        <>
          <GeneralCard settings={settings} onSaved={setSettings} />
          <div className="flex flex-col gap-1">
            <h2 className="text-subheading font-medium text-ink">Messages</h2>
            <p className="text-[13px] text-ink-soft">Change the wording to suit your clinic. Words in curly brackets are filled in for each patient.</p>
          </div>
          {(Object.keys(MESSAGE_LABEL) as MessageKind[]).map((kind) => (
            <TemplateCard
              key={kind}
              kind={kind}
              templates={settings.templates.filter((t) => t.kind === kind)}
              startLanguage={settings.language}
              samples={sampleValues(clinic?.name ?? 'Your clinic', settings.googleReviewUrl)}
              onSaved={setSettings}
            />
          ))}
        </>
      )}
    </div>
  )
}

function GeneralCard({ settings, onSaved }: { settings: Settings; onSaved: (s: Settings) => void }) {
  const [language, setLanguage] = useState<Language>(settings.language)
  const [reviewUrl, setReviewUrl] = useState(settings.googleReviewUrl ?? '')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault()
    setError(null)
    setNotice(null)
    setSaving(true)
    try {
      onSaved(await whatsappApi.saveSettings(language, reviewUrl.trim()))
      setNotice('Saved.')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-xl border border-rule bg-white p-5 shadow-sm">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <SelectField
          label="Messages open in"
          options={LANGUAGE_OPTIONS}
          value={LANGUAGE_LABEL[language]}
          onChange={(e) => setLanguage(e.target.value === LANGUAGE_LABEL.hi ? 'hi' : 'en')}
        />
        <Field
          label="Google review link"
          hint="For review requests"
          type="url"
          value={reviewUrl}
          onChange={(e) => setReviewUrl(e.target.value)}
          placeholder="https://g.page/r/your-clinic/review"
        />
      </div>
      <p className="text-[12px] text-ink-faint">
        Find the review link in your Google Business Profile, under Ask for reviews. Each message can still be sent in the other language.
      </p>
      {error && <p className="rounded-lg bg-crit-soft px-3.5 py-2.5 text-body text-crit">{error}</p>}
      {notice && <p className="rounded-lg bg-ok-soft px-3.5 py-2.5 text-body text-ok">{notice}</p>}
      <ButtonRow>
        <Button type="submit" disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </ButtonRow>
    </form>
  )
}

function TemplateCard({
  kind,
  templates,
  startLanguage,
  samples,
  onSaved,
}: {
  kind: MessageKind
  templates: MessageTemplate[]
  startLanguage: Language
  samples: Record<string, string>
  onSaved: (s: Settings) => void
}) {
  const [language, setLanguage] = useState<Language>(startLanguage)
  const current = templates.find((t) => t.language === language)!
  const [body, setBody] = useState(current.body)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setBody(current.body)
    setError(null)
  }, [current.body, language])

  async function save(action: () => Promise<Settings>) {
    setError(null)
    setSaving(true)
    try {
      onSaved(await action())
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save the message.')
    } finally {
      setSaving(false)
    }
  }

  const changed = body.trim() !== current.body

  return (
    <section aria-label={MESSAGE_LABEL[kind]} className="flex flex-col gap-3 rounded-xl border border-rule bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="flex items-center gap-2 text-subheading font-medium text-ink">
            {MESSAGE_LABEL[kind]}
            {!current.isDefault && <Pill variant="accent">Your wording</Pill>}
          </span>
          <span className="text-[12px] text-ink-faint">{WHEN_USED[kind]}</span>
        </div>
        <div className="ml-auto flex rounded-lg border border-rule p-0.5" role="group" aria-label="Language">
          {(['en', 'hi'] as Language[]).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLanguage(l)}
              aria-pressed={language === l}
              className={`rounded-md px-3 py-1 text-[13px] font-medium transition-colors ${
                language === l ? 'bg-accent text-white' : 'text-ink-soft hover:text-ink'
              }`}
            >
              {LANGUAGE_LABEL[l]}
            </button>
          ))}
        </div>
      </div>
      <TextareaField label="Wording" value={body} maxLength={1000} onChange={(e) => setBody(e.target.value)} />
      <p className="text-[12px] text-ink-faint">You can use {current.placeholders.map((p) => `{${p}}`).join(', ')}</p>
      <div className="flex flex-col gap-1 rounded-lg bg-[#e7f7ee] px-3.5 py-2.5">
        <span className="text-[11px] font-medium uppercase tracking-wider text-[#128C7E]">Preview</span>
        <p className="whitespace-pre-line break-words text-[13px] text-ink">{preview(body, samples)}</p>
      </div>
      {error && <p className="rounded-lg bg-crit-soft px-3.5 py-2.5 text-body text-crit">{error}</p>}
      <ButtonRow>
        {!current.isDefault && (
          <Button variant="ghost" disabled={saving} onClick={() => save(() => whatsappApi.resetTemplate(kind, language))}>
            Use Denti's wording
          </Button>
        )}
        {changed && (
          <Button variant="ghost" disabled={saving} onClick={() => setBody(current.body)}>
            Undo changes
          </Button>
        )}
        <Button disabled={saving || !changed || !body.trim()} onClick={() => save(() => whatsappApi.saveTemplate(kind, language, body))}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </ButtonRow>
    </section>
  )
}
