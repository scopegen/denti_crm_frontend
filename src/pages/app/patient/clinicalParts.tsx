import { useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { Download, Eye, FileText } from 'lucide-react'
import { Button } from '../../../components/Button'
import { ButtonRow } from '../../../components/ButtonRow'
import { Field } from '../../../components/Field'
import { Modal } from '../../../components/Modal'
import { Pill } from '../../../components/Pill'
import { RxRows } from '../../../components/RxRows'
import { WhatsAppButton } from '../../../components/WhatsAppButton'
import { ApiError } from '../../../lib/api'
import { clinicalApi, RX_FREQUENCIES, type Prescription, type PrescriptionVersion, type RxItem } from '../../../lib/clinicalApi'
import { formatDate, formatTime } from '../../../lib/date'
import { saveFile, viewFile } from '../../../lib/files'
import type { Service } from '../../../lib/settingsApi'
import type { Person } from '../../../lib/todayApi'
import { useAuth } from '../../../state/AuthContext'
import type { PatientContext } from '../PatientDetail'

// Pieces shared by the Consultations and Treatments sheets: a labelled block of text, the
// prescription card with its PDF and history, the prescription form fields, and pickers
// for the doctor and the treatment.

const selectClass =
  'w-full rounded-lg border border-rule bg-white px-3.5 py-2.5 text-body text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent-tint'

export function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[12px] text-ink-faint">{label}</span>
      <p className="whitespace-pre-line text-body text-ink">{value}</p>
    </div>
  )
}

function frequencyLabel(value: string | null): string | null {
  return value ? RX_FREQUENCIES.find((f) => f.value === value)?.value ?? value : null
}

export function rxLine(item: RxItem): string {
  return [item.medicine, item.dose, frequencyLabel(item.frequency), item.duration ? `for ${item.duration}` : null, item.instructions]
    .filter(Boolean)
    .join(' · ')
}

/** A saved prescription: its words, View PDF, Download, sending it on WhatsApp, and the
 * history of versions. */
export function PrescriptionPanel({ prescription }: { prescription: Prescription }) {
  // Shown inside a patient's page, which knows the patient.
  const patientId = useOutletContext<PatientContext | undefined>()?.patient.id
  const [historyOpen, setHistoryOpen] = useState(false)
  const [pdfError, setPdfError] = useState<string | null>(null)

  async function openPdf(download: boolean) {
    setPdfError(null)
    try {
      if (download) await saveFile(() => clinicalApi.prescriptionPdf(prescription.id, { download: true }), 'Prescription.pdf')
      else await viewFile(() => clinicalApi.prescriptionPdf(prescription.id))
    } catch (err) {
      setPdfError(err instanceof ApiError ? err.message : 'Could not open the prescription.')
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-accent/40 bg-accent-tint/40 p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-body font-medium text-accent-deep">
          <FileText size={15} /> Prescription
        </span>
        <ButtonRow className="!gap-1.5">
          {prescription.version > 1 && <Pill>Version {prescription.version}</Pill>}
          {prescription.version > 1 && (
            <Button variant="ghost" className="!px-2.5 !py-1 text-[13px]" onClick={() => setHistoryOpen(true)}>
              History
            </Button>
          )}
          <Button variant="ghost" className="flex items-center gap-1.5 !px-2.5 !py-1 text-[13px]" onClick={() => openPdf(true)}>
            <Download size={14} /> Download
          </Button>
          {patientId && (
            <WhatsAppButton className="!px-3 !py-1 text-[13px]" message={{ patientId, kind: 'prescription', prescriptionId: prescription.id }} />
          )}
          <Button variant="tint" className="flex items-center gap-1.5 !px-3 !py-1 text-[13px]" onClick={() => openPdf(false)}>
            <Eye size={14} /> View PDF
          </Button>
        </ButtonRow>
      </div>
      {pdfError && <p className="rounded-lg bg-crit-soft px-3.5 py-2 text-[13px] text-crit">{pdfError}</p>}
      {prescription.diagnosis && <Detail label="Diagnosis" value={prescription.diagnosis} />}
      {prescription.items.length > 0 && (
        <ol className="list-decimal pl-5 text-body text-ink">
          {prescription.items.map((item, i) => (
            <li key={i}>{rxLine(item)}</li>
          ))}
        </ol>
      )}
      {prescription.advice && <Detail label="Advice" value={prescription.advice} />}
      {historyOpen && <VersionHistory prescriptionId={prescription.id} onClose={() => setHistoryOpen(false)} />}
    </div>
  )
}

function VersionHistory({ prescriptionId, onClose }: { prescriptionId: string; onClose: () => void }) {
  const { clinic } = useAuth()
  const [versions, setVersions] = useState<PrescriptionVersion[] | null>(null)
  useEffect(() => {
    clinicalApi.prescriptionVersions(prescriptionId).then(setVersions).catch(() => setVersions([]))
  }, [prescriptionId])
  return (
    <Modal title="Prescription history" onClose={onClose}>
      <p className="text-[13px] text-ink-soft">Every version is kept exactly as it was written. Newest first.</p>
      {versions?.map((v) => (
        <div key={v.version} className="flex flex-col gap-1.5 border-t border-rule pt-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[12px] font-medium text-ink-soft">
              Version {v.version} · {v.editedBy.name} · {formatDate(v.editedAt, clinic?.timezone)} {formatTime(v.editedAt, clinic?.timezone)}
            </span>
            <ButtonRow>
              <Button
                variant="ghost"
                className="flex items-center gap-1.5 !px-2.5 !py-1 text-[13px]"
                onClick={() => viewFile(() => clinicalApi.prescriptionPdf(prescriptionId, { version: v.version })).catch(() => undefined)}
              >
                <Eye size={14} /> View PDF
              </Button>
            </ButtonRow>
          </div>
          {v.diagnosis && <Detail label="Diagnosis" value={v.diagnosis} />}
          {v.items.length > 0 && (
            <ol className="list-decimal pl-5 text-body text-ink">
              {v.items.map((item, i) => (
                <li key={i}>{rxLine(item)}</li>
              ))}
            </ol>
          )}
          {v.advice && <Detail label="Advice" value={v.advice} />}
        </div>
      ))}
    </Modal>
  )
}

/** Diagnosis, medicines and advice. Locked for everyone but the doctor who wrote it. */
export function PrescriptionFields({
  diagnosis,
  items,
  advice,
  onDiagnosis,
  onItems,
  onAdvice,
  lockedFor,
}: {
  diagnosis: string
  items: RxItem[]
  advice: string
  onDiagnosis: (value: string) => void
  onItems: (items: RxItem[]) => void
  onAdvice: (value: string) => void
  /** The prescribing doctor's name when someone else is editing; the fields are then read only. */
  lockedFor?: string | null
}) {
  const locked = Boolean(lockedFor)
  return (
    <div className="flex flex-col gap-4 rounded-lg border border-rule bg-paper-raised p-4">
      <span className="text-subheading font-medium text-ink">Prescription</span>
      {locked && (
        <p className="rounded-lg bg-warn-soft px-3.5 py-2.5 text-[13px] text-warn">Only {lockedFor} can change this prescription.</p>
      )}
      <Field label="Diagnosis" value={diagnosis} disabled={locked} onChange={(e) => onDiagnosis(e.target.value)} />
      <RxRows value={items} onChange={onItems} disabled={locked} />
      <Field label="Advice" value={advice} disabled={locked} onChange={(e) => onAdvice(e.target.value)} placeholder="Warm saline rinses" />
    </div>
  )
}

export function DoctorSelect({
  label,
  doctors,
  value,
  onChange,
}: {
  label: string
  doctors: Person[]
  value: string
  onChange: (id: string) => void
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-body font-medium text-ink">
        {label} <span className="text-accent">*</span>
      </span>
      <select required value={value} onChange={(e) => onChange(e.target.value)} className={selectClass}>
        {doctors.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
      </select>
    </label>
  )
}

/** The clinic's services, grouped by category, for choosing a treatment. */
export function ServiceSelect({
  services,
  value,
  onChange,
  label,
  required = true,
}: {
  services: Service[]
  value: string
  onChange: (id: string) => void
  label?: string
  required?: boolean
}) {
  const grouped = useMemo(() => {
    const groups = new Map<string, Service[]>()
    for (const s of services) groups.set(s.category ?? 'General', [...(groups.get(s.category ?? 'General') ?? []), s])
    return [...groups.entries()]
  }, [services])

  const select = (
    <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label ?? 'Treatment'} className={selectClass}>
      <option value="">Choose a treatment</option>
      {grouped.map(([category, items]) => (
        <optgroup key={category} label={category}>
          {items.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  )
  if (!label) return select
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-body font-medium text-ink">
        {label} {required && <span className="text-accent">*</span>}
      </span>
      {select}
    </label>
  )
}

export function useDefaultDoctor(doctors: Person[], preferred?: string): [string, (id: string) => void] {
  const { staff } = useAuth()
  const fallback = preferred ?? (staff?.treatsPatients ? staff.id : doctors[0]?.id ?? '')
  const [doctorId, setDoctorId] = useState(fallback)
  useEffect(() => {
    if (!doctorId && doctors.length > 0) setDoctorId(staff?.treatsPatients ? staff.id : doctors[0].id)
  }, [doctors, doctorId, staff])
  return [doctorId, setDoctorId]
}
