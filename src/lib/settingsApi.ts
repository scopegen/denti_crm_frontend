import { api } from './api'
import { toStaff, type RawStaff, type Staff } from '../types/auth'

// Services and staff: every call, and the snake_case to camelCase conversion.

export type ServiceKind = 'in_house' | 'lab'

export interface Service {
  id: string
  name: string
  category: string | null
  kind: ServiceKind
  /** Null for doctors, who never see prices. */
  listedPricePaise: number | null
  recallAfterMonths: number | null
  /** An extraction: once done, the tooth shows as missing on the tooth chart. */
  removesTooth: boolean
  active: boolean
}

export interface ServiceInput {
  name: string
  category: string | null
  kind: ServiceKind
  listedPricePaise: number
  recallAfterMonths: number | null
  removesTooth: boolean
  active: boolean
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function toService(raw: any): Service {
  return {
    id: raw.id,
    name: raw.name,
    category: raw.category,
    kind: raw.kind,
    listedPricePaise: raw.listed_price_paise,
    recallAfterMonths: raw.recall_after_months,
    removesTooth: raw.removes_tooth,
    active: raw.active,
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

function servicePayload(input: ServiceInput) {
  return {
    name: input.name,
    category: input.category,
    kind: input.kind,
    listed_price_paise: input.listedPricePaise,
    recall_after_months: input.recallAfterMonths,
    removes_tooth: input.removesTooth,
    active: input.active,
  }
}

export interface NewStaffInput {
  name: string
  email: string
  role: 'admin' | 'doctor'
  password: string
  phone: string
  qualification: string
  specialty: string
  registrationNo: string
}

export interface StaffDetailsInput {
  name: string
  phone: string
  qualification: string
  specialty: string
  registrationNo: string
}

export const settingsApi = {
  async services(includeRetired = false): Promise<Service[]> {
    return (await api.get<unknown[]>(`/services${includeRetired ? '?include_retired=true' : ''}`)).map(toService)
  },
  async addService(input: ServiceInput): Promise<Service> {
    return toService(await api.post('/services', servicePayload(input)))
  },
  async updateService(id: string, input: ServiceInput): Promise<Service> {
    return toService(await api.patch(`/services/${id}`, servicePayload(input)))
  },

  async staff(): Promise<Staff[]> {
    return (await api.get<RawStaff[]>('/staff')).map(toStaff)
  },
  async addStaff(input: NewStaffInput): Promise<Staff> {
    return toStaff(
      await api.post<RawStaff>('/staff', {
        name: input.name,
        email: input.email,
        role: input.role,
        password: input.password,
        phone: input.phone || null,
        qualification: input.qualification || null,
        specialty: input.specialty || null,
        registration_no: input.registrationNo || null,
      }),
    )
  },
  async updateStaff(id: string, input: StaffDetailsInput): Promise<Staff> {
    return toStaff(
      await api.patch<RawStaff>(`/staff/${id}`, {
        name: input.name,
        phone: input.phone || null,
        qualification: input.qualification || null,
        specialty: input.specialty || null,
        registration_no: input.registrationNo || null,
      }),
    )
  },
  /** A login paused by a move to a smaller plan, switched back on when the plan has room. */
  async resumeStaff(id: string): Promise<Staff> {
    return toStaff(await api.post<RawStaff>(`/staff/${id}/resume`))
  },
  async deactivateStaff(id: string): Promise<Staff> {
    return toStaff(await api.post<RawStaff>(`/staff/${id}/deactivate`))
  },

  /** Saves a signature from a data URL: a photo of it on paper, or one drawn on screen. */
  async setSignature(id: string, imageData: string): Promise<Staff> {
    return toStaff(await api.put<RawStaff>(`/staff/${id}/signature`, { image_data: imageData }))
  },
  async removeSignature(id: string): Promise<Staff> {
    return toStaff(await api.delete<RawStaff>(`/staff/${id}/signature`))
  },
  async signatureImage(id: string): Promise<Blob> {
    return (await api.file(`/staff/${id}/signature`)).blob
  },
}

export const SERVICE_KIND_LABEL: Record<ServiceKind, string> = { in_house: 'In house', lab: 'Sent to a lab' }
