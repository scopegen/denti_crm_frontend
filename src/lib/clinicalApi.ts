import { api, type FileDownload } from './api'
import type { Person } from './todayApi'

// Consultations and prescriptions: every call, and the snake_case to camelCase conversion.

export interface RxItem {
  medicine: string
  dose: string | null
  frequency: string | null
  duration: string | null
  instructions: string | null
}

export interface Prescription {
  id: string
  prescribingDoctor: Person
  version: number
  diagnosis: string | null
  advice: string | null
  items: RxItem[]
  editedAt: string
  canEdit: boolean
}

export interface PrescriptionVersion {
  version: number
  diagnosis: string | null
  advice: string | null
  items: RxItem[]
  editedBy: Person
  editedAt: string
}

export interface Recommendation {
  serviceId: string
  serviceName: string
  teeth: number[]
}

export interface Consultation {
  id: string
  patientId: string
  doctor: Person
  consultDate: string
  chiefComplaint: string
  oralExamination: string
  xrayTaken: boolean
  recommendations: Recommendation[]
  recommendationNote: string | null
  prescription: Prescription | null
  /** Problems marked on the tooth chart at this consultation (Standard and Pro). */
  findings: { id: string; tooth: number; problem: string; resolution: 'treated' | 'cleared' | null }[]
  createdAt: string
  updatedAt: string | null
}

export interface PrescriptionInput {
  diagnosis: string
  advice: string
  items: RxItem[]
}

export interface ConsultationInput {
  doctorId: string
  consultDate: string | null
  chiefComplaint: string
  oralExamination: string
  xrayTaken: boolean
  recommendations: { serviceId: string; teeth: number[] }[]
  recommendationNote: string
  prescription: PrescriptionInput
  /** The problems this consultation marks on the chart; on an edit, the full list. */
  findings: { tooth: number; problem: string }[]
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export function toPrescription(raw: any): Prescription {
  return {
    id: raw.id,
    prescribingDoctor: raw.prescribing_doctor,
    version: raw.version,
    diagnosis: raw.diagnosis,
    advice: raw.advice,
    items: raw.items,
    editedAt: raw.edited_at,
    canEdit: raw.can_edit,
  }
}

function toConsultation(raw: any): Consultation {
  return {
    id: raw.id,
    patientId: raw.patient_id,
    doctor: raw.doctor,
    consultDate: raw.consult_date,
    chiefComplaint: raw.chief_complaint,
    oralExamination: raw.oral_examination,
    xrayTaken: raw.xray_taken,
    recommendations: raw.recommendations.map((r: any) => ({ serviceId: r.service_id, serviceName: r.service_name, teeth: r.teeth })),
    recommendationNote: raw.recommendation_note,
    prescription: raw.prescription ? toPrescription(raw.prescription) : null,
    findings: raw.findings,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** A prescription as the API takes it: empty medicine rows are left out. */
export function prescriptionPayload(input: PrescriptionInput) {
  return {
    diagnosis: input.diagnosis,
    advice: input.advice,
    items: input.items.filter((i) => i.medicine.trim() !== ''),
  }
}

function consultationPayload(input: ConsultationInput) {
  return {
    doctor_id: input.doctorId,
    consult_date: input.consultDate || null,
    chief_complaint: input.chiefComplaint,
    oral_examination: input.oralExamination,
    xray_taken: input.xrayTaken,
    recommendations: input.recommendations.map((r) => ({ service_id: r.serviceId, teeth: r.teeth })),
    recommendation_note: input.recommendationNote,
    prescription: prescriptionPayload(input.prescription),
    findings: input.findings,
  }
}

export const clinicalApi = {
  async consultations(patientId: string): Promise<Consultation[]> {
    return (await api.get<unknown[]>(`/patients/${patientId}/consultations`)).map(toConsultation)
  },
  async addConsultation(patientId: string, input: ConsultationInput): Promise<Consultation> {
    return toConsultation(await api.post(`/patients/${patientId}/consultations`, consultationPayload(input)))
  },
  async updateConsultation(id: string, input: ConsultationInput): Promise<Consultation> {
    return toConsultation(await api.patch(`/consultations/${id}`, consultationPayload(input)))
  },
  async prescriptionVersions(prescriptionId: string): Promise<PrescriptionVersion[]> {
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    const raw = await api.get<any[]>(`/prescriptions/${prescriptionId}/versions`)
    return raw.map((v) => ({
      version: v.version,
      diagnosis: v.diagnosis,
      advice: v.advice,
      items: v.items,
      editedBy: v.edited_by,
      editedAt: v.edited_at,
    }))
  },
  /** The printable prescription with the doctor's signature: the latest version, or an earlier one. */
  prescriptionPdf(prescriptionId: string, options: { download?: boolean; version?: number } = {}): Promise<FileDownload> {
    const query = new URLSearchParams()
    if (options.download) query.set('download', 'true')
    if (options.version) query.set('version', String(options.version))
    const suffix = query.size ? `?${query}` : ''
    return api.file(`/prescriptions/${prescriptionId}/pdf${suffix}`)
  },
}

/** The dosing shorthand doctors use, with what each means. */
export const RX_FREQUENCIES: { value: string; label: string }[] = [
  { value: 'OD', label: 'OD (once a day)' },
  { value: 'BD', label: 'BD (twice a day)' },
  { value: 'TDS', label: 'TDS (three times a day)' },
  { value: 'QID', label: 'QID (four times a day)' },
  { value: 'HS', label: 'HS (at bedtime)' },
  { value: 'SOS', label: 'SOS (when needed)' },
  { value: 'STAT', label: 'STAT (at once)' },
]

/** "36, 37" typed by a doctor as tooth numbers. Returns null if any part is not a number. */
export function parseTeeth(value: string): number[] | null {
  const parts = value.split(/[,\s]+/).filter(Boolean)
  if (parts.some((p) => !/^\d{2}$/.test(p))) return null
  return parts.map(Number)
}
