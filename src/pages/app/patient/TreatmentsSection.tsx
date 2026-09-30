import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useOutletContext } from 'react-router-dom'
import { Button } from '../../../components/Button'
import { ButtonRow } from '../../../components/ButtonRow'
import { Field, TextareaField } from '../../../components/Field'
import { Pill } from '../../../components/Pill'
import { WhatsAppButton } from '../../../components/WhatsAppButton'
import { ApiError } from '../../../lib/api'
import { parseTeeth, type RxItem } from '../../../lib/clinicalApi'
import { formatDate, todayInZone } from '../../../lib/date'
import { formatINR, paiseToRupeesInput, rupeesToPaise } from '../../../lib/money'
import { settingsApi, type Service } from '../../../lib/settingsApi'
import { todayApi, type Person } from '../../../lib/todayApi'
import {
  finalPrice,
  STATUS_LABEL,
  treatmentsApi,
  type AdjustmentType,
  type PriceInput,
  type Suggestion,
  type Treatment,
  type TreatmentStatus,
  type Visit,
} from '../../../lib/treatmentsApi'
import { useAuth } from '../../../state/AuthContext'
import type { PatientContext } from '../PatientDetail'
import { Detail, DoctorSelect, PrescriptionFields, PrescriptionPanel, ServiceSelect, useDefaultDoctor } from './clinicalParts'
import { EstimatesPanel } from './EstimatesPanel'

// The Treatments sheet on a patient's page. A doctor can plan or start any of the clinic's
// services, recommended in a consultation or not; recommendations not yet started are
// offered at the top. Starting puts the charge on the bill. Each sitting is a visit, which
// can carry a prescription, finish the treatment and book the next sitting. Prices,
// discounts and cancelling a started treatment are for the owner and receptionist only;
// doctors never see amounts.

const STATUS_PILL: Record<TreatmentStatus, 'warning' | 'outline' | 'success' | 'crit'> = {
  ongoing: 'warning',
  planned: 'outline',
  finished: 'success',
  cancelled: 'crit',
}

const small = '!px-3 !py-1.5 text-[13px]'

function teethText(teeth: number[]): string {
  return teeth.length === 1 ? `Tooth ${teeth[0]}` : `Teeth ${teeth.join(', ')}`
}

function Notice({ tone, children }: { tone: 'crit' | 'warn' | 'ok'; children: ReactNode }) {
  const tones = { crit: 'bg-crit-soft text-crit', warn: 'bg-warn-soft text-warn', ok: 'bg-ok-soft text-ok' }
  return <p className={`rounded-lg px-3.5 py-2.5 text-body ${tones[tone]}`}>{children}</p>
}

export function TreatmentsSection() {
  const { patient } = useOutletContext<PatientContext>()
  const { clinic, staff } = useAuth()
  const isAdmin = staff?.role === 'owner' || staff?.role === 'admin'
  const showTeeth = clinic?.plan === 'standard' || clinic?.plan === 'pro'
  const [treatments, setTreatments] = useState<Treatment[] | null>(null)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [doctors, setDoctors] = useState<Person[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [adding, setAdding] = useState<{ from?: Suggestion } | null>(null)
  const [showCancelled, setShowCancelled] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    Promise.all([treatmentsApi.list(patient.id), treatmentsApi.suggestions(patient.id)])
      .then(([list, suggested]) => {
        setTreatments(list)
        setSuggestions(suggested)
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load treatments.'))
  }, [patient.id])

  useEffect(() => {
    load()
    todayApi.doctors().then(setDoctors).catch(() => setDoctors([]))
    settingsApi.services().then(setServices).catch(() => setServices([]))
  }, [load])

  const replace = (updated: Treatment) => {
    setTreatments((current) => current?.map((t) => (t.id === updated.id ? updated : t)) ?? null)
    treatmentsApi.suggestions(patient.id).then(setSuggestions).catch(() => undefined)
  }

  const active = (treatments ?? []).filter((t) => t.status !== 'cancelled')
  const cancelled = (treatments ?? []).filter((t) => t.status === 'cancelled')

  return (
    <div className="flex flex-col gap-4">
      {error && <Notice tone="crit">{error}</Notice>}
      {!adding && (
        <ButtonRow>
          <Button onClick={() => setAdding({})}>+ New treatment</Button>
        </ButtonRow>
      )}

      {treatments && (
        <EstimatesPanel
          patientId={patient.id}
          services={services}
          doctors={doctors}
          suggestions={suggestions}
          treatments={treatments}
          showTeeth={showTeeth}
          onAccepted={load}
        />
      )}

      {!adding && suggestions.length > 0 && (
        <div className="flex flex-col gap-2 rounded-xl border border-dashed border-accent/50 bg-accent-tint/30 p-4">
          <span className="text-body font-medium text-accent-deep">Recommended in consultations, not started yet</span>
          {suggestions.map((s) => (
            <div key={`${s.consultationId}-${s.service.id}`} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white px-3.5 py-2.5">
              <div className="flex min-w-0 flex-col">
                <span className="text-body text-ink">
                  {s.service.name}
                  {s.teeth.length > 0 ? ` · ${teethText(s.teeth)}` : ''}
                </span>
                <span className="text-[12px] text-ink-faint">
                  Recommended by {s.doctor.name} on {formatDate(s.consultDate)}
                </span>
              </div>
              <ButtonRow>
                <Button variant="tint" className={small} onClick={() => setAdding({ from: s })}>
                  Plan or start
                </Button>
              </ButtonRow>
            </div>
          ))}
        </div>
      )}

      {adding && (
        <NewTreatmentForm
          patientId={patient.id}
          services={services}
          doctors={doctors}
          showTeeth={showTeeth}
          isAdmin={isAdmin}
          from={adding.from}
          onSaved={() => {
            setAdding(null)
            load()
          }}
          onCancel={() => setAdding(null)}
        />
      )}

      {treatments && treatments.length === 0 && !adding && <p className="text-body text-ink-soft">No treatments yet.</p>}
      {active.map((t) => (
        <TreatmentCard key={t.id} treatment={t} doctors={doctors} services={services} showTeeth={showTeeth} isAdmin={isAdmin} onChanged={replace} />
      ))}

      {cancelled.length > 0 && (
        <>
          <ButtonRow>
            <Button variant="ghost" className={small} onClick={() => setShowCancelled(!showCancelled)}>
              {showCancelled ? 'Hide cancelled' : `Show cancelled (${cancelled.length})`}
            </Button>
          </ButtonRow>
          {showCancelled &&
            cancelled.map((t) => (
              <TreatmentCard key={t.id} treatment={t} doctors={doctors} services={services} showTeeth={showTeeth} isAdmin={isAdmin} onChanged={replace} />
            ))}
        </>
      )}
    </div>
  )
}

function NewTreatmentForm({
  patientId,
  services,
  doctors,
  showTeeth,
  isAdmin,
  from,
  onSaved,
  onCancel,
}: {
  patientId: string
  services: Service[]
  doctors: Person[]
  showTeeth: boolean
  isAdmin: boolean
  from?: Suggestion
  onSaved: () => void
  onCancel: () => void
}) {
  const [serviceId, setServiceId] = useState(from?.service.id ?? '')
  const [teeth, setTeeth] = useState(from?.teeth.join(', ') ?? '')
  const [doctorId, setDoctorId] = useDefaultDoctor(doctors)
  const [notes, setNotes] = useState('')
  const [price, setPrice] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // The price starts as the service's listed price; the owner or receptionist can change it.
  useEffect(() => {
    const listed = services.find((s) => s.id === serviceId)?.listedPricePaise
    setPrice(listed != null ? paiseToRupeesInput(listed) : '')
  }, [serviceId, services])

  async function save(start: boolean) {
    const parsedTeeth = showTeeth && teeth.trim() ? parseTeeth(teeth) : []
    if (parsedTeeth === null) {
      setError('Enter teeth as two digit numbers separated by commas, such as 36, 37.')
      return
    }
    const pricePaise = isAdmin ? rupeesToPaise(price) : null
    if (isAdmin && pricePaise === null) {
      setError('Enter the price in rupees, such as 6500.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await treatmentsApi.create(patientId, {
        serviceId,
        doctorId,
        teeth: parsedTeeth,
        consultationId: from && from.service.id === serviceId ? from.consultationId : null,
        notes,
        start,
        pricePaise,
      })
      onSaved()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save the treatment.')
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-rule bg-white p-5 shadow-sm">
      <span className="text-subheading font-medium text-ink">New treatment</span>
      {from && (
        <p className="text-[13px] text-ink-soft">
          Recommended by {from.doctor.name} on {formatDate(from.consultDate)}. You can change anything below.
        </p>
      )}
      <div className={`grid grid-cols-1 gap-4 ${showTeeth ? 'sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]' : ''}`}>
        <ServiceSelect label="Treatment" services={services} value={serviceId} onChange={setServiceId} />
        {showTeeth && <Field label="Teeth" hint="Optional" value={teeth} onChange={(e) => setTeeth(e.target.value)} placeholder="36, 37" />}
      </div>
      <div className={`grid grid-cols-1 gap-4 ${isAdmin ? 'sm:grid-cols-2' : ''}`}>
        <DoctorSelect label="Doctor" doctors={doctors} value={doctorId} onChange={setDoctorId} />
        {isAdmin && (
          <Field label="Price (₹)" required inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} hint="Listed price" />
        )}
      </div>
      <TextareaField label="Notes" hint="Optional" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Plan, material, shade" />
      <p className="text-[13px] text-ink-soft">
        {isAdmin
          ? 'A planned treatment is not billed. Starting it puts the price on the bill.'
          : 'Plan it for later, or start it today. Adding a visit to a planned treatment also starts it.'}
      </p>
      {error && <Notice tone="crit">{error}</Notice>}
      <ButtonRow>
        <Button variant="ghost" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button variant="secondary" onClick={() => save(false)} disabled={saving || !serviceId || !doctorId}>
          Plan for later
        </Button>
        <Button onClick={() => save(true)} disabled={saving || !serviceId || !doctorId}>
          {saving ? 'Saving…' : 'Start today'}
        </Button>
      </ButtonRow>
    </div>
  )
}

type Mode = null | 'visit' | 'edit' | 'price' | 'handoff' | 'cancel' | 'finish' | { visit: Visit }

function TreatmentCard({
  treatment: t,
  doctors,
  services,
  showTeeth,
  isAdmin,
  onChanged,
}: {
  treatment: Treatment
  doctors: Person[]
  services: Service[]
  showTeeth: boolean
  isAdmin: boolean
  onChanged: (t: Treatment) => void
}) {
  const { patient } = useOutletContext<PatientContext>()
  const { clinic } = useAuth()
  const [mode, setMode] = useState<Mode>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const open = t.status === 'planned' || t.status === 'ongoing'

  async function run(action: () => Promise<Treatment>) {
    setBusy(true)
    setError(null)
    try {
      onChanged(await action())
      setMode(null)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const done = (updated: Treatment) => {
    onChanged(updated)
    setMode(null)
  }

  let when = ''
  if (t.status === 'planned') when = 'Not started'
  if (t.status === 'ongoing' && t.startedOn) when = `Started ${formatDate(t.startedOn)}`
  if (t.status === 'finished' && t.finishedOn) when = `Finished ${formatDate(t.finishedOn)}`
  if (t.status === 'cancelled' && t.cancelledOn) when = `Cancelled ${formatDate(t.cancelledOn)}`
  const visitCount = t.visits.length ? ` · ${t.visits.length} ${t.visits.length === 1 ? 'visit' : 'visits'}` : ''

  return (
    <section
      aria-label={t.teeth.length > 0 ? `${t.service.name}, ${teethText(t.teeth)}` : t.service.name}
      className={`flex flex-col gap-3 rounded-xl border bg-white p-5 shadow-sm ${t.status === 'ongoing' ? 'border-warn/40' : 'border-rule'}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-subheading font-medium text-ink">
            {t.service.name}
            {t.teeth.length > 0 && <span className="font-normal text-ink-soft"> · {teethText(t.teeth)}</span>}
          </span>
          <span className="text-[12px] text-ink-faint">
            {t.doctor.name} · {when}
            {visitCount}
          </span>
        </div>
        <Pill variant={STATUS_PILL[t.status]}>{STATUS_LABEL[t.status]}</Pill>
      </div>

      {t.money && <MoneyLine treatment={t} />}
      {t.notes && <Detail label="Notes" value={t.notes} />}
      {t.cancelReason && <Detail label="Why it was cancelled" value={t.cancelReason} />}
      {t.status === 'finished' && clinic?.plan !== 'basic' && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-paper-raised/60 px-3 py-2">
          <span className="text-[13px] text-ink-soft">Happy with the result? Ask for feedback and a Google review.</span>
          <ButtonRow>
            <WhatsAppButton label="Ask for a review" className={small} message={{ patientId: patient.id, kind: 'review_request', treatmentId: t.id }} />
          </ButtonRow>
        </div>
      )}
      {t.handoffs.map((h, i) => (
        <p key={i} className="text-[12px] text-ink-soft">
          Handed over from {h.fromDoctor.name} to {h.toDoctor.name} on {formatDate(h.changedAt)}
          {h.reason ? `: ${h.reason}` : ''}
        </p>
      ))}

      {t.visits.length > 0 && (
        <div className="flex flex-col gap-2 border-t border-rule pt-3">
          {t.visits.map((v, i) =>
            typeof mode === 'object' && mode?.visit.id === v.id ? (
              <VisitForm key={v.id} treatment={t} doctors={doctors} initial={v} onSaved={done} onCancel={() => setMode(null)} />
            ) : (
              <div key={v.id} className="flex flex-col gap-2 rounded-lg bg-paper-raised/60 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-body font-medium text-ink">
                    Visit {i + 1} · {formatDate(v.visitDate)} <span className="font-normal text-ink-soft">· {v.doctor.name}</span>
                  </span>
                  {t.status !== 'cancelled' && (
                    <ButtonRow>
                      <Button variant="ghost" className={small} onClick={() => setMode({ visit: v })}>
                        Edit
                      </Button>
                    </ButtonRow>
                  )}
                </div>
                {v.notes && <p className="whitespace-pre-line text-body text-ink">{v.notes}</p>}
                {v.prescription && <PrescriptionPanel prescription={v.prescription} />}
              </div>
            ),
          )}
        </div>
      )}

      {error && <Notice tone="crit">{error}</Notice>}

      {mode === 'visit' && <VisitForm treatment={t} doctors={doctors} onSaved={done} onCancel={() => setMode(null)} />}
      {mode === 'edit' && (
        <EditForm treatment={t} services={services} showTeeth={showTeeth} onSaved={done} onCancel={() => setMode(null)} />
      )}
      {mode === 'price' && <PriceForm treatment={t} onSaved={done} onCancel={() => setMode(null)} />}
      {mode === 'handoff' && <HandoffForm treatment={t} doctors={doctors} onSaved={done} onCancel={() => setMode(null)} />}
      {mode === 'cancel' && <CancelForm treatment={t} onSaved={done} onCancel={() => setMode(null)} />}
      {mode === 'finish' && (
        <div className="flex flex-col gap-3 rounded-lg border border-ok/30 bg-ok-soft/50 p-4">
          <span className="text-body text-ink">Mark {t.service.name} as finished today?</span>
          <ButtonRow>
            <Button variant="ghost" onClick={() => setMode(null)} disabled={busy}>
              Not yet
            </Button>
            <Button onClick={() => run(() => treatmentsApi.finish(t.id))} disabled={busy}>
              Finish treatment
            </Button>
          </ButtonRow>
        </div>
      )}

      {mode === null && t.status !== 'cancelled' && (
        <ButtonRow className="border-t border-rule pt-3">
          {open && (t.status === 'planned' || isAdmin) && (
            <Button variant="ghost" className={small} onClick={() => setMode('cancel')}>
              Cancel treatment
            </Button>
          )}
          {open && (
            <Button variant="ghost" className={small} onClick={() => setMode('handoff')}>
              Hand over
            </Button>
          )}
          <Button variant="ghost" className={small} onClick={() => setMode('edit')}>
            Edit
          </Button>
          {isAdmin && (
            <Button variant="ghost" className={small} onClick={() => setMode('price')}>
              Price
            </Button>
          )}
          {t.status === 'planned' && (
            <>
              <Button variant="secondary" className={small} onClick={() => setMode('visit')}>
                + Add visit
              </Button>
              <Button className={small} onClick={() => run(() => treatmentsApi.start(t.id))} disabled={busy}>
                Start today
              </Button>
            </>
          )}
          {t.status === 'ongoing' && (
            <>
              <Button variant="secondary" className={small} onClick={() => setMode('finish')}>
                Finish
              </Button>
              <Button className={small} onClick={() => setMode('visit')}>
                + Add visit
              </Button>
            </>
          )}
        </ButtonRow>
      )}
    </section>
  )
}

function describeChange(type: AdjustmentType | null, value: number): string {
  if (!type || !value) return ''
  return type === 'percent' ? `${value / 100}%` : formatINR(value)
}

function MoneyLine({ treatment: t }: { treatment: Treatment }) {
  const m = t.money!
  const changes = [
    m.adjustmentType && m.adjustmentValue ? `increase ${describeChange(m.adjustmentType, m.adjustmentValue)}` : null,
    m.discountType && m.discountValue ? `discount ${describeChange(m.discountType, m.discountValue)}` : null,
  ].filter(Boolean)
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-paper-raised px-3.5 py-2.5 text-body">
      <span className="text-ink">
        <span className="font-medium">{formatINR(m.finalPricePaise)}</span>
        {changes.length > 0 && (
          <span className="text-ink-soft">
            {' '}
            ({formatINR(m.pricePaise)}, {changes.join(', ')})
          </span>
        )}
      </span>
      <span className="text-[13px] text-ink-soft">
        {t.status === 'planned' ? 'Not on the bill until it starts' : `On the bill: ${formatINR(m.billedPaise)}`}
      </span>
    </div>
  )
}

function VisitForm({
  treatment: t,
  doctors,
  initial,
  onSaved,
  onCancel,
}: {
  treatment: Treatment
  doctors: Person[]
  initial?: Visit
  onSaved: (t: Treatment) => void
  onCancel: () => void
}) {
  const { clinic } = useAuth()
  const today = todayInZone(clinic?.timezone)
  const [visitDate, setVisitDate] = useState(initial?.visitDate ?? today)
  const [doctorId, setDoctorId] = useDefaultDoctor(doctors, initial?.doctor.id ?? t.doctor.id)
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [diagnosis, setDiagnosis] = useState(initial?.prescription?.diagnosis ?? '')
  const [items, setItems] = useState<RxItem[]>(initial?.prescription?.items ?? [])
  const [advice, setAdvice] = useState(initial?.prescription?.advice ?? '')
  const [finish, setFinish] = useState(false)
  const [nextOn, setNextOn] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const locked = Boolean(initial?.prescription && !initial.prescription.canEdit)

  async function save() {
    setSaving(true)
    setError(null)
    const prescription = locked && initial?.prescription
      ? { diagnosis: initial.prescription.diagnosis ?? '', advice: initial.prescription.advice ?? '', items: initial.prescription.items }
      : { diagnosis, advice, items }
    try {
      const updated = initial
        ? await treatmentsApi.updateVisit(initial.id, { visitDate, doctorId, notes, prescription })
        : await treatmentsApi.addVisit(t.id, {
            visitDate,
            doctorId,
            notes,
            prescription,
            finishTreatment: finish,
            nextVisit: nextOn ? { dueOn: nextOn, reason: '' } : null,
          })
      onSaved(updated)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save the visit.')
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-rule bg-paper p-4">
      <span className="text-body font-medium text-ink">{initial ? 'Edit visit' : 'New visit'}</span>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <DoctorSelect label="Doctor" doctors={doctors} value={doctorId} onChange={setDoctorId} />
        <Field label="Date" type="date" required min={t.startedOn ?? undefined} max={today} value={visitDate} onChange={(e) => setVisitDate(e.target.value)} />
      </div>
      <TextareaField label="What was done" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Access opening, working length taken" />
      <PrescriptionFields
        diagnosis={diagnosis}
        items={items}
        advice={advice}
        onDiagnosis={setDiagnosis}
        onItems={setItems}
        onAdvice={setAdvice}
        lockedFor={locked ? initial?.prescription?.prescribingDoctor.name : null}
      />
      {!initial && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="flex items-center gap-2 self-end pb-2.5 text-body text-ink">
            <input type="checkbox" checked={finish} onChange={(e) => setFinish(e.target.checked)} className="h-4 w-4 accent-accent" />
            Last sitting: finish the treatment
          </label>
          <Field
            label="Next sitting"
            hint="Optional"
            type="date"
            min={today}
            value={nextOn}
            onChange={(e) => setNextOn(e.target.value)}
          />
        </div>
      )}
      {nextOn && !initial && <p className="text-[13px] text-ink-soft">The patient shows under Expected on the Today page that day.</p>}
      {error && <Notice tone="crit">{error}</Notice>}
      <ButtonRow>
        <Button variant="ghost" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={save} disabled={saving || !doctorId || !visitDate}>
          {saving ? 'Saving…' : initial ? 'Save changes' : 'Save visit'}
        </Button>
      </ButtonRow>
    </div>
  )
}

function EditForm({
  treatment: t,
  services,
  showTeeth,
  onSaved,
  onCancel,
}: {
  treatment: Treatment
  services: Service[]
  showTeeth: boolean
  onSaved: (t: Treatment) => void
  onCancel: () => void
}) {
  const [serviceId, setServiceId] = useState(t.service.id)
  const [teeth, setTeeth] = useState(t.teeth.join(', '))
  const [notes, setNotes] = useState(t.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    const parsed = showTeeth && teeth.trim() ? parseTeeth(teeth) : showTeeth ? [] : t.teeth
    if (parsed === null) {
      setError('Enter teeth as two digit numbers separated by commas, such as 36, 37.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      onSaved(await treatmentsApi.update(t.id, { serviceId, teeth: parsed, notes }))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save the changes.')
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-rule bg-paper p-4">
      <div className={`grid grid-cols-1 gap-4 ${showTeeth ? 'sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]' : ''}`}>
        {t.status === 'planned' ? (
          <ServiceSelect label="Treatment" services={services} value={serviceId} onChange={setServiceId} />
        ) : (
          <Field label="Treatment" value={t.service.name} disabled hint="Fixed once started" />
        )}
        {showTeeth && <Field label="Teeth" hint="Optional" value={teeth} onChange={(e) => setTeeth(e.target.value)} placeholder="36, 37" />}
      </div>
      <TextareaField label="Notes" hint="Optional" value={notes} onChange={(e) => setNotes(e.target.value)} />
      {error && <Notice tone="crit">{error}</Notice>}
      <ButtonRow>
        <Button variant="ghost" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={save} disabled={saving || !serviceId}>
          {saving ? 'Saving…' : 'Save changes'}
        </Button>
      </ButtonRow>
    </div>
  )
}

const CHANGE_OPTIONS: { value: '' | AdjustmentType; label: string }[] = [
  { value: '', label: 'None' },
  { value: 'percent', label: 'Percent' },
  { value: 'amount', label: 'Amount (₹)' },
]

function ChangeField({
  label,
  type,
  value,
  onType,
  onValue,
}: {
  label: string
  type: '' | AdjustmentType
  value: string
  onType: (t: '' | AdjustmentType) => void
  onValue: (v: string) => void
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-body font-medium text-ink">{label}</span>
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2">
        <select
          aria-label={`${label} type`}
          value={type}
          onChange={(e) => onType(e.target.value as '' | AdjustmentType)}
          className="w-full rounded-lg border border-rule bg-white px-3.5 py-2.5 text-body text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent-tint"
        >
          {CHANGE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <input
          aria-label={label}
          inputMode="decimal"
          disabled={!type}
          value={type ? value : ''}
          onChange={(e) => onValue(e.target.value)}
          placeholder={type === 'percent' ? '10' : type === 'amount' ? '500' : ''}
          className="w-full rounded-lg border border-rule bg-white px-3.5 py-2.5 text-body text-ink outline-none placeholder:text-ink-faint focus:border-accent focus:ring-2 focus:ring-accent-tint disabled:bg-paper-raised"
        />
      </div>
    </div>
  )
}

/** "10" or "12.5" percent as basis points; an amount in rupees as paise. */
function toStored(type: '' | AdjustmentType, text: string): number | null {
  if (!type) return 0
  if (type === 'amount') return rupeesToPaise(text)
  if (!/^\d+(\.\d{1,2})?$/.test(text.trim())) return null
  return Math.round(Number(text) * 100)
}

function fromStored(type: AdjustmentType | null, value: number): string {
  if (!type || !value) return ''
  return type === 'amount' ? paiseToRupeesInput(value) : String(value / 100)
}

function PriceForm({ treatment: t, onSaved, onCancel }: { treatment: Treatment; onSaved: (t: Treatment) => void; onCancel: () => void }) {
  const m = t.money!
  const [price, setPrice] = useState(paiseToRupeesInput(m.pricePaise))
  const [adjType, setAdjType] = useState<'' | AdjustmentType>(m.adjustmentType ?? '')
  const [adjValue, setAdjValue] = useState(fromStored(m.adjustmentType, m.adjustmentValue))
  const [discType, setDiscType] = useState<'' | AdjustmentType>(m.discountType ?? '')
  const [discValue, setDiscValue] = useState(fromStored(m.discountType, m.discountValue))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const pricePaise = rupeesToPaise(price)
  const adjustment = toStored(adjType, adjValue)
  const discount = toStored(discType, discValue)
  const input: PriceInput | null =
    pricePaise !== null && adjustment !== null && discount !== null
      ? { pricePaise, adjustmentType: adjType || null, adjustmentValue: adjustment, discountType: discType || null, discountValue: discount }
      : null
  const final = input ? finalPrice(input) : null
  const started = t.status === 'ongoing' || t.status === 'finished'

  async function save() {
    if (!input) {
      setError('Check the amounts: rupees such as 6500, and percentages such as 10.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      onSaved(await treatmentsApi.setPrice(t.id, input))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save the price.')
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-rule bg-paper p-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label="Price (₹)" required inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
        <ChangeField label="Increase" type={adjType} value={adjValue} onType={setAdjType} onValue={setAdjValue} />
        <ChangeField label="Discount" type={discType} value={discValue} onType={setDiscType} onValue={setDiscValue} />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-paper-raised px-3.5 py-2.5 text-body">
        <span className="text-ink-soft">
          Final price: <span className="font-medium text-ink">{final === null ? 'Check the amounts' : formatINR(final)}</span>
        </span>
        {started && final !== null && final !== m.billedPaise && (
          <span className="text-[13px] text-ink-soft">
            The bill {final > m.billedPaise ? 'goes up' : 'comes down'} by {formatINR(Math.abs(final - m.billedPaise))}.
          </span>
        )}
      </div>
      {error && <Notice tone="crit">{error}</Notice>}
      <ButtonRow>
        <Button variant="ghost" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={save} disabled={saving || !input}>
          {saving ? 'Saving…' : 'Save price'}
        </Button>
      </ButtonRow>
    </div>
  )
}

function HandoffForm({
  treatment: t,
  doctors,
  onSaved,
  onCancel,
}: {
  treatment: Treatment
  doctors: Person[]
  onSaved: (t: Treatment) => void
  onCancel: () => void
}) {
  const others = doctors.filter((d) => d.id !== t.doctor.id)
  const [doctorId, setDoctorId] = useState(others[0]?.id ?? '')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setSaving(true)
    setError(null)
    try {
      onSaved(await treatmentsApi.handOff(t.id, doctorId, reason))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not hand over the treatment.')
      setSaving(false)
    }
  }

  if (others.length === 0) {
    return (
      <div className="flex flex-col gap-3 rounded-lg border border-rule bg-paper p-4">
        <p className="text-body text-ink-soft">There is no other doctor at the clinic to hand this treatment to.</p>
        <ButtonRow>
          <Button variant="ghost" onClick={onCancel}>
            Close
          </Button>
        </ButtonRow>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-rule bg-paper p-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <DoctorSelect label="Hand over to" doctors={others} value={doctorId} onChange={setDoctorId} />
        <Field label="Reason" hint="Optional" value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} placeholder="Needs an endodontist" />
      </div>
      {error && <Notice tone="crit">{error}</Notice>}
      <ButtonRow>
        <Button variant="ghost" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={save} disabled={saving || !doctorId}>
          {saving ? 'Saving…' : 'Hand over'}
        </Button>
      </ButtonRow>
    </div>
  )
}

function CancelForm({ treatment: t, onSaved, onCancel }: { treatment: Treatment; onSaved: (t: Treatment) => void; onCancel: () => void }) {
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setSaving(true)
    setError(null)
    try {
      onSaved(await treatmentsApi.cancel(t.id, reason))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not cancel the treatment.')
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-crit-soft bg-crit-soft/30 p-4">
      <Field label="Why is it cancelled?" required value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} placeholder="Patient chose a crown instead" />
      {t.status === 'ongoing' && t.money && t.money.billedPaise !== 0 && (
        <p className="text-[13px] text-crit">Its charge of {formatINR(t.money.billedPaise)} comes off the bill.</p>
      )}
      {error && <Notice tone="crit">{error}</Notice>}
      <ButtonRow>
        <Button variant="ghost" onClick={onCancel} disabled={saving}>
          Keep treatment
        </Button>
        <Button variant="danger" onClick={save} disabled={saving || !reason.trim()}>
          {saving ? 'Cancelling…' : 'Cancel treatment'}
        </Button>
      </ButtonRow>
    </div>
  )
}
