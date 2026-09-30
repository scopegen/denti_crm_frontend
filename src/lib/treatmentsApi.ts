import { api } from './api'
import { prescriptionPayload, toPrescription, type Prescription, type PrescriptionInput } from './clinicalApi'
import type { Person } from './todayApi'

// Treatments and their visits: every call, and the snake_case to camelCase conversion.
// Money comes back only for the owner and receptionist; for doctors it is null.

export type TreatmentStatus = 'planned' | 'ongoing' | 'finished' | 'cancelled'
export type AdjustmentType = 'percent' | 'amount'

export const STATUS_LABEL: Record<TreatmentStatus, string> = {
  planned: 'Planned',
  ongoing: 'In progress',
  finished: 'Finished',
  cancelled: 'Cancelled',
}

export interface Visit {
  id: string
  visitDate: string
  doctor: Person
  notes: string | null
  prescription: Prescription | null
}

export interface Handoff {
  fromDoctor: Person
  toDoctor: Person
  changedBy: Person
  changedAt: string
  reason: string | null
}

export interface TreatmentMoney {
  pricePaise: number
  adjustmentType: AdjustmentType | null
  /** Paise for an amount; basis points for a percent (1000 is 10%). */
  adjustmentValue: number
  discountType: AdjustmentType | null
  discountValue: number
  finalPricePaise: number
  billedPaise: number
}

export interface Treatment {
  id: string
  service: { id: string; name: string }
  teeth: number[]
  doctor: Person
  status: TreatmentStatus
  consultationId: string | null
  notes: string | null
  startedOn: string | null
  finishedOn: string | null
  cancelledOn: string | null
  cancelReason: string | null
  visits: Visit[]
  handoffs: Handoff[]
  money: TreatmentMoney | null
}

export interface Suggestion {
  consultationId: string
  consultDate: string
  doctor: Person
  service: { id: string; name: string }
  teeth: number[]
}

export interface NewTreatment {
  serviceId: string
  doctorId: string
  teeth: number[]
  consultationId: string | null
  notes: string
  start: boolean
  /** Owner and receptionist only. */
  pricePaise: number | null
}

export interface PriceInput {
  pricePaise: number
  adjustmentType: AdjustmentType | null
  adjustmentValue: number
  discountType: AdjustmentType | null
  discountValue: number
}

export interface VisitInput {
  visitDate: string
  doctorId: string
  notes: string
  prescription: PrescriptionInput
  finishTreatment: boolean
  nextVisit: { dueOn: string; reason: string } | null
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function toTreatment(raw: any): Treatment {
  return {
    id: raw.id,
    service: raw.service,
    teeth: raw.teeth,
    doctor: raw.doctor,
    status: raw.status,
    consultationId: raw.consultation_id,
    notes: raw.notes,
    startedOn: raw.started_on,
    finishedOn: raw.finished_on,
    cancelledOn: raw.cancelled_on,
    cancelReason: raw.cancel_reason,
    visits: raw.visits.map((v: any) => ({
      id: v.id,
      visitDate: v.visit_date,
      doctor: v.doctor,
      notes: v.notes,
      prescription: v.prescription ? toPrescription(v.prescription) : null,
    })),
    handoffs: raw.handoffs.map((h: any) => ({
      fromDoctor: h.from_doctor,
      toDoctor: h.to_doctor,
      changedBy: h.changed_by,
      changedAt: h.changed_at,
      reason: h.reason,
    })),
    money: raw.money
      ? {
          pricePaise: raw.money.price_paise,
          adjustmentType: raw.money.adjustment_type,
          adjustmentValue: raw.money.adjustment_value,
          discountType: raw.money.discount_type,
          discountValue: raw.money.discount_value,
          finalPricePaise: raw.money.final_price_paise,
          billedPaise: raw.money.billed_paise,
        }
      : null,
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

function visitPayload(input: VisitInput) {
  return {
    visit_date: input.visitDate || null,
    doctor_id: input.doctorId,
    notes: input.notes,
    prescription: prescriptionPayload(input.prescription),
    finish_treatment: input.finishTreatment,
    next_visit: input.nextVisit ? { due_on: input.nextVisit.dueOn, reason: input.nextVisit.reason } : null,
  }
}

export const treatmentsApi = {
  async list(patientId: string): Promise<Treatment[]> {
    return (await api.get<unknown[]>(`/patients/${patientId}/treatments`)).map(toTreatment)
  },
  async suggestions(patientId: string): Promise<Suggestion[]> {
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    const raw = await api.get<any[]>(`/patients/${patientId}/treatments/suggestions`)
    return raw.map((s) => ({
      consultationId: s.consultation_id,
      consultDate: s.consult_date,
      doctor: s.doctor,
      service: s.service,
      teeth: s.teeth,
    }))
  },
  async create(patientId: string, input: NewTreatment): Promise<Treatment> {
    return toTreatment(
      await api.post(`/patients/${patientId}/treatments`, {
        service_id: input.serviceId,
        doctor_id: input.doctorId,
        teeth: input.teeth,
        consultation_id: input.consultationId,
        notes: input.notes,
        start: input.start,
        price_paise: input.pricePaise,
      }),
    )
  },
  async update(id: string, input: { serviceId: string; teeth: number[]; notes: string }): Promise<Treatment> {
    return toTreatment(await api.patch(`/treatments/${id}`, { service_id: input.serviceId, teeth: input.teeth, notes: input.notes }))
  },
  async setPrice(id: string, input: PriceInput): Promise<Treatment> {
    return toTreatment(
      await api.put(`/treatments/${id}/price`, {
        price_paise: input.pricePaise,
        adjustment_type: input.adjustmentType,
        adjustment_value: input.adjustmentValue,
        discount_type: input.discountType,
        discount_value: input.discountValue,
      }),
    )
  },
  async start(id: string): Promise<Treatment> {
    return toTreatment(await api.post(`/treatments/${id}/start`, {}))
  },
  async finish(id: string): Promise<Treatment> {
    return toTreatment(await api.post(`/treatments/${id}/finish`, {}))
  },
  async cancel(id: string, reason: string): Promise<Treatment> {
    return toTreatment(await api.post(`/treatments/${id}/cancel`, { reason }))
  },
  async handOff(id: string, toDoctorId: string, reason: string): Promise<Treatment> {
    return toTreatment(await api.post(`/treatments/${id}/handoff`, { to_doctor_id: toDoctorId, reason }))
  },
  async addVisit(treatmentId: string, input: VisitInput): Promise<Treatment> {
    return toTreatment(await api.post(`/treatments/${treatmentId}/visits`, visitPayload(input)))
  },
  async updateVisit(visitId: string, input: Omit<VisitInput, 'finishTreatment' | 'nextVisit'>): Promise<Treatment> {
    return toTreatment(
      await api.patch(`/visits/${visitId}`, {
        visit_date: input.visitDate,
        doctor_id: input.doctorId,
        notes: input.notes,
        prescription: prescriptionPayload(input.prescription),
      }),
    )
  },
}

/** Final price the same way the server works it out: an increase, then a discount on it. */
export function finalPrice(input: PriceInput): number {
  const share = (amount: number, bp: number) => Math.floor((amount * bp + 5000) / 10000)
  let adjusted = input.pricePaise
  if (input.adjustmentType === 'percent') adjusted += share(input.pricePaise, input.adjustmentValue)
  if (input.adjustmentType === 'amount') adjusted += input.adjustmentValue
  let discount = 0
  if (input.discountType === 'percent') discount = share(adjusted, input.discountValue)
  if (input.discountType === 'amount') discount = input.discountValue
  return Math.max(adjusted - discount, 0)
}
