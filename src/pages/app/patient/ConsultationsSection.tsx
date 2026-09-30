import { useCallback, useEffect, useState, type SubmitEvent } from 'react'
import { useLocation, useOutletContext } from 'react-router-dom'
import { X } from 'lucide-react'
import { Button } from '../../../components/Button'
import { ButtonRow } from '../../../components/ButtonRow'
import { Field, TextareaField } from '../../../components/Field'
import { Pill } from '../../../components/Pill'
import { calculateAge } from '../../../lib/age'
import { ApiError } from '../../../lib/api'
import { clinicalApi, parseTeeth, type Consultation, type ConsultationInput, type RxItem } from '../../../lib/clinicalApi'
import { formatDate, todayInZone } from '../../../lib/date'
import { settingsApi, type Service } from '../../../lib/settingsApi'
import { todayApi, type Person } from '../../../lib/todayApi'
import { useAuth } from '../../../state/AuthContext'
import type { PatientContext } from '../PatientDetail'
import { Detail, DoctorSelect, PrescriptionFields, PrescriptionPanel, ServiceSelect, useDefaultDoctor } from './clinicalParts'
import { ConsultationChart, type FormFinding } from './ConsultationChart'

// The Consultations sheet on a patient's page. A consultation and its prescription are one
// form and one save, as in Ranco. Only the prescribing doctor can change a prescription;
// every change is kept as a version.

export function ConsultationsSection() {
  const { patient } = useOutletContext<PatientContext>()
  const location = useLocation()
  const openForm = Boolean((location.state as { openForm?: boolean } | null)?.openForm)
  const { clinic } = useAuth()
  const [items, setItems] = useState<Consultation[] | null>(null)
  const [doctors, setDoctors] = useState<Person[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [adding, setAdding] = useState(openForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const showTeeth = clinic?.plan === 'standard' || clinic?.plan === 'pro'
  const age = calculateAge(patient.dob, patient.birthYear)
  const childFirst = age !== null && age < 12

  const load = useCallback(() => {
    clinicalApi
      .consultations(patient.id)
      .then(setItems)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load consultations.'))
  }, [patient.id])

  useEffect(() => {
    load()
    todayApi.doctors().then(setDoctors).catch(() => setDoctors([]))
    settingsApi.services().then(setServices).catch(() => setServices([]))
  }, [load])

  return (
    <div className="flex flex-col gap-4">
      {error && <p className="rounded-lg bg-crit-soft px-3.5 py-2.5 text-body text-crit">{error}</p>}
      {!adding && (
        <ButtonRow>
          <Button
            onClick={() => {
              setEditingId(null)
              setAdding(true)
            }}
          >
            + New consultation
          </Button>
        </ButtonRow>
      )}
      {adding && (
        <ConsultationForm
          patientId={patient.id}
          doctors={doctors}
          services={services}
          showTeeth={showTeeth}
          childFirst={childFirst}
          onSaved={() => {
            setAdding(false)
            load()
          }}
          onCancel={() => setAdding(false)}
        />
      )}
      {items && items.length === 0 && !adding && <p className="text-body text-ink-soft">No consultations yet.</p>}
      {items?.map((c) =>
        editingId === c.id ? (
          <ConsultationForm
            key={c.id}
            patientId={patient.id}
            initial={c}
            doctors={doctors}
            services={services}
            showTeeth={showTeeth}
            childFirst={childFirst}
            onSaved={() => {
              setEditingId(null)
              load()
            }}
            onCancel={() => setEditingId(null)}
          />
        ) : (
          <ConsultationCard
            key={c.id}
            consultation={c}
            onEdit={() => {
              setAdding(false)
              setEditingId(c.id)
            }}
          />
        ),
      )}
    </div>
  )
}

function ConsultationCard({ consultation: c, onEdit }: { consultation: Consultation; onEdit: () => void }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-rule bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-subheading font-medium text-ink">{c.doctor.name}</span>
          <span className="text-[12px] text-ink-faint">
            {formatDate(c.consultDate)}
            {c.xrayTaken ? ' · X-ray taken' : ''}
          </span>
        </div>
        <ButtonRow>
          <Button variant="secondary" className="!px-3.5 !py-1.5" onClick={onEdit}>
            Edit
          </Button>
        </ButtonRow>
      </div>

      <Detail label="Chief complaint" value={c.chiefComplaint} />
      <Detail label="Oral examination" value={c.oralExamination} />

      {c.recommendations.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-[12px] text-ink-faint">Recommended treatment</span>
          <div className="flex flex-wrap gap-1.5">
            {c.recommendations.map((r) => (
              <Pill key={r.serviceId} variant="accent">
                {r.serviceName}
                {r.teeth.length > 0 ? ` · ${r.teeth.join(', ')}` : ''}
              </Pill>
            ))}
          </div>
        </div>
      )}
      {c.recommendationNote && <Detail label="Other recommendation" value={c.recommendationNote} />}

      {c.findings.some((f) => f.resolution !== 'cleared') && (
        <div className="flex flex-col gap-1.5">
          <span className="text-[12px] text-ink-faint">Found on the tooth chart</span>
          <div className="flex flex-wrap gap-1.5">
            {c.findings
              .filter((f) => f.resolution !== 'cleared')
              .map((f) => (
                <Pill key={f.id} variant={f.resolution === 'treated' ? 'success' : 'crit'}>
                  {f.tooth} · {f.problem === 'missing' ? 'Missing' : f.problem}
                  {f.resolution === 'treated' ? ' (treated)' : ''}
                </Pill>
              ))}
          </div>
        </div>
      )}

      {c.prescription && <PrescriptionPanel prescription={c.prescription} />}
    </div>
  )
}

function ConsultationForm({
  patientId,
  initial,
  doctors,
  services,
  showTeeth,
  childFirst,
  onSaved,
  onCancel,
}: {
  patientId: string
  initial?: Consultation
  doctors: Person[]
  services: Service[]
  showTeeth: boolean
  /** Open the chart on milk teeth, for a young child. */
  childFirst: boolean
  onSaved: () => void
  onCancel: () => void
}) {
  const { clinic } = useAuth()
  const today = todayInZone(clinic?.timezone)
  const [doctorId, setDoctorId] = useDefaultDoctor(doctors, initial?.doctor.id)
  const [consultDate, setConsultDate] = useState(initial?.consultDate ?? today)
  const [chiefComplaint, setChiefComplaint] = useState(initial?.chiefComplaint ?? '')
  const [oralExamination, setOralExamination] = useState(initial?.oralExamination ?? '')
  const [xrayTaken, setXrayTaken] = useState(initial?.xrayTaken ?? false)
  const [diagnosis, setDiagnosis] = useState(initial?.prescription?.diagnosis ?? '')
  const [items, setItems] = useState<RxItem[]>(initial?.prescription?.items ?? [])
  const [advice, setAdvice] = useState(initial?.prescription?.advice ?? '')
  const [recommendations, setRecommendations] = useState<{ serviceId: string; teeth: number[] }[]>(
    initial?.recommendations.map((r) => ({ serviceId: r.serviceId, teeth: r.teeth })) ?? [],
  )
  const [recommendationNote, setRecommendationNote] = useState(initial?.recommendationNote ?? '')
  // What this exam found on the chart. On an edit, the ones still open from this consultation.
  const [findings, setFindings] = useState<FormFinding[]>(
    initial?.findings.filter((f) => f.resolution === null).map((f) => ({ tooth: f.tooth, problem: f.problem })) ?? [],
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Only the doctor who wrote a prescription may change it; others see it read only.
  const prescriptionLocked = Boolean(initial?.prescription && !initial.prescription.canEdit)

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const input: ConsultationInput = {
      doctorId,
      consultDate,
      chiefComplaint,
      oralExamination,
      xrayTaken,
      recommendations,
      recommendationNote,
      prescription: prescriptionLocked && initial?.prescription
        ? { diagnosis: initial.prescription.diagnosis ?? '', advice: initial.prescription.advice ?? '', items: initial.prescription.items }
        : { diagnosis, advice, items },
      findings: showTeeth ? findings : [],
    }
    try {
      if (initial) await clinicalApi.updateConsultation(initial.id, input)
      else await clinicalApi.addConsultation(patientId, input)
      onSaved()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save the consultation.')
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5 rounded-xl border border-rule bg-white p-5 shadow-sm">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <DoctorSelect label="Consulting doctor" doctors={doctors} value={doctorId} onChange={setDoctorId} />
        <Field label="Date" type="date" required max={today} value={consultDate} onChange={(e) => setConsultDate(e.target.value)} />
      </div>

      <TextareaField
        label="Chief complaint"
        required
        value={chiefComplaint}
        onChange={(e) => setChiefComplaint(e.target.value)}
        placeholder="Pain in upper left molar for 3 days"
      />
      <TextareaField label="Oral examination" required value={oralExamination} onChange={(e) => setOralExamination(e.target.value)} />

      {showTeeth && (
        <ConsultationChart
          patientId={patientId}
          consultationId={initial?.id}
          childFirst={childFirst}
          findings={findings}
          onFindings={setFindings}
          services={services}
          recommendations={recommendations}
          onRecommendations={setRecommendations}
        />
      )}

      <label className="flex items-center gap-2 text-body text-ink">
        <input type="checkbox" checked={xrayTaken} onChange={(e) => setXrayTaken(e.target.checked)} className="h-4 w-4 accent-accent" />
        X-ray taken
      </label>

      <PrescriptionFields
        diagnosis={diagnosis}
        items={items}
        advice={advice}
        onDiagnosis={setDiagnosis}
        onItems={setItems}
        onAdvice={setAdvice}
        lockedFor={prescriptionLocked ? initial?.prescription?.prescribingDoctor.name : null}
      />

      <RecommendationsField services={services} value={recommendations} onChange={setRecommendations} showTeeth={showTeeth} />
      <TextareaField label="Other recommendation" value={recommendationNote} onChange={(e) => setRecommendationNote(e.target.value)} />

      {error && <p className="rounded-lg bg-crit-soft px-3.5 py-2.5 text-body text-crit">{error}</p>}
      <ButtonRow>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving || !doctorId}>
          {saving ? 'Saving…' : initial ? 'Save changes' : 'Save consultation'}
        </Button>
      </ButtonRow>
    </form>
  )
}

function RecommendationsField({
  services,
  value,
  onChange,
  showTeeth,
}: {
  services: Service[]
  value: { serviceId: string; teeth: number[] }[]
  onChange: (items: { serviceId: string; teeth: number[] }[]) => void
  showTeeth: boolean
}) {
  const [serviceId, setServiceId] = useState('')
  const [teeth, setTeeth] = useState('')
  const [error, setError] = useState<string | null>(null)

  function add() {
    if (!serviceId) return
    const parsed = showTeeth ? parseTeeth(teeth) : []
    if (parsed === null) {
      setError('Enter tooth numbers like 36, 37.')
      return
    }
    setError(null)
    onChange([...value.filter((v) => v.serviceId !== serviceId), { serviceId, teeth: parsed }])
    setServiceId('')
    setTeeth('')
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-body font-medium text-ink">Recommended treatment</span>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_10rem_auto]">
        <ServiceSelect services={services} value={serviceId} onChange={setServiceId} />
        {showTeeth ? (
          <input
            value={teeth}
            onChange={(e) => setTeeth(e.target.value)}
            placeholder="Teeth: 36, 37"
            aria-label="Teeth"
            className="w-full rounded-lg border border-rule bg-white px-3.5 py-2.5 text-body text-ink placeholder:text-ink-faint outline-none focus:border-accent focus:ring-2 focus:ring-accent-tint"
          />
        ) : (
          <span className="hidden sm:block" />
        )}
        <ButtonRow>
          <Button variant="secondary" onClick={add} disabled={!serviceId}>
            + Add
          </Button>
        </ButtonRow>
      </div>
      {error && <p className="text-[13px] text-crit">{error}</p>}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((r) => {
            const service = services.find((s) => s.id === r.serviceId)
            return (
              <span key={r.serviceId} className="flex items-center gap-1.5 rounded-full bg-accent-tint py-1 pl-3 pr-1.5 text-[12px] font-medium text-accent-deep">
                {service?.name ?? 'Service'}
                {r.teeth.length > 0 ? ` · ${r.teeth.join(', ')}` : ''}
                <button
                  type="button"
                  onClick={() => onChange(value.filter((v) => v.serviceId !== r.serviceId))}
                  aria-label={`Remove ${service?.name ?? 'treatment'}`}
                  className="flex items-center justify-center rounded-full p-0.5 transition-colors hover:bg-white/60"
                >
                  <X size={12} />
                </button>
              </span>
            )
          })}
        </div>
      )}
    </div>
  )
}

