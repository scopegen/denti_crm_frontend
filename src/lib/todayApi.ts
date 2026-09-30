import { api } from './api'

// The Today page, arrivals and follow ups: every call, and the snake_case to camelCase conversion.

export interface PatientBrief {
  id: string
  code: string
  name: string
  phone: string
  medicalConditions: string[]
}

export interface Person {
  id: string
  name: string
}

export interface Arrival {
  id: string
  patient: PatientBrief
  arrivedAt: string
  preferredDoctor: Person | null
  seenAt: string | null
}

export type FollowUpKind = 'call' | 'visit'

export interface FollowUp {
  id: string
  kind: FollowUpKind
  dueOn: string
  dueTime: string | null
  reason: string | null
  status: 'upcoming' | 'done' | 'cancelled'
  source: string
  createdAt: string
  completedAt: string | null
  overdue: boolean
}

export interface FollowUpItem extends FollowUp {
  patient: PatientBrief
  arrivedToday: boolean
}

export interface TodayData {
  date: string
  expected: FollowUpItem[]
  calls: FollowUpItem[]
  arrived: Arrival[]
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function toBrief(raw: any): PatientBrief {
  return { id: raw.id, code: raw.code, name: raw.name, phone: raw.phone, medicalConditions: raw.medical_conditions }
}

function toArrival(raw: any): Arrival {
  return {
    id: raw.id,
    patient: toBrief(raw.patient),
    arrivedAt: raw.arrived_at,
    preferredDoctor: raw.preferred_doctor,
    seenAt: raw.seen_at,
  }
}

function toFollowUp(raw: any): FollowUp {
  return {
    id: raw.id,
    kind: raw.kind,
    dueOn: raw.due_on,
    dueTime: raw.due_time,
    reason: raw.reason,
    status: raw.status,
    source: raw.source,
    createdAt: raw.created_at,
    completedAt: raw.completed_at,
    overdue: raw.overdue,
  }
}

function toItem(raw: any): FollowUpItem {
  return { ...toFollowUp(raw), patient: toBrief(raw.patient), arrivedToday: raw.arrived_today }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export const todayApi = {
  async today(doctorId?: string): Promise<TodayData> {
    const raw = await api.get<{ date: string; expected: unknown[]; calls: unknown[]; arrived: unknown[] }>(
      doctorId ? `/today?doctor_id=${doctorId}` : '/today',
    )
    return { date: raw.date, expected: raw.expected.map(toItem), calls: raw.calls.map(toItem), arrived: raw.arrived.map(toArrival) }
  },

  async markArrived(patientId: string, preferredDoctorId?: string | null): Promise<Arrival> {
    return toArrival(await api.post('/arrivals', { patient_id: patientId, preferred_doctor_id: preferredDoctorId || null }))
  },

  cancelArrival(arrivalId: string): Promise<void> {
    return api.post(`/arrivals/${arrivalId}/cancel`)
  },

  async followUps(patientId: string): Promise<FollowUp[]> {
    return (await api.get<unknown[]>(`/patients/${patientId}/follow-ups`)).map(toFollowUp)
  },

  async addFollowUp(patientId: string, input: { kind: FollowUpKind; dueOn: string; dueTime: string | null; reason: string }): Promise<FollowUp> {
    return toFollowUp(
      await api.post(`/patients/${patientId}/follow-ups`, {
        kind: input.kind,
        due_on: input.dueOn,
        due_time: input.dueTime || null,
        reason: input.reason,
      }),
    )
  },

  async followUpDone(id: string): Promise<FollowUp> {
    return toFollowUp(await api.post(`/follow-ups/${id}/done`))
  },

  async followUpCancel(id: string): Promise<FollowUp> {
    return toFollowUp(await api.post(`/follow-ups/${id}/cancel`))
  },

  doctors(): Promise<Person[]> {
    return api.get<Person[]>('/staff/doctors')
  },
}
