import { api, type FileDownload } from './api'
import type { Person } from './todayApi'
import type { AdjustmentType } from './treatmentsApi'

// Treatment estimates (quotes): every call, and the snake_case to camelCase conversion.
// Amounts come back only for the owner and receptionist; for doctors they are null.

export type EstimateStatus = 'given' | 'accepted' | 'declined' | 'expired'

export const ESTIMATE_STATUS_LABEL: Record<EstimateStatus, string> = {
  given: 'Estimate given',
  accepted: 'Accepted',
  declined: 'Declined',
  expired: 'Expired',
}

export interface EstimateItem {
  id: string
  serviceId: string
  description: string
  teeth: number[]
  sittings: number | null
  quantity: number
  unitPricePaise: number | null
  amountPaise: number | null
}

export interface EstimateOption {
  id: string
  label: string
  items: EstimateItem[]
  subtotalPaise: number | null
  discountPaise: number | null
  totalPaise: number | null
}

export interface Estimate {
  id: string
  numberText: string
  givenOn: string
  validUntil: string
  status: EstimateStatus
  doctor: Person
  notes: string | null
  options: EstimateOption[]
  acceptedOptionId: string | null
}

export interface EstimateItemInput {
  serviceId: string
  teeth: number[]
  sittings: number | null
  unitPricePaise: number
  quantity: number
}

export interface EstimateInput {
  doctorId: string
  validUntil: string
  notes: string
  discountType: AdjustmentType | null
  discountValue: number
  options: { label: string; items: EstimateItemInput[] }[]
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function toEstimates(raw: any[]): Estimate[] {
  return raw.map((e) => ({
    id: e.id,
    numberText: e.number_text,
    givenOn: e.given_on,
    validUntil: e.valid_until,
    status: e.status,
    doctor: e.doctor,
    notes: e.notes,
    acceptedOptionId: e.accepted_option_id,
    options: e.options.map((o: any) => ({
      id: o.id,
      label: o.label,
      subtotalPaise: o.subtotal_paise,
      discountPaise: o.discount_paise,
      totalPaise: o.total_paise,
      items: o.items.map((i: any) => ({
        id: i.id,
        serviceId: i.service_id,
        description: i.description,
        teeth: i.teeth,
        sittings: i.sittings,
        quantity: i.quantity,
        unitPricePaise: i.unit_price_paise,
        amountPaise: i.amount_paise,
      })),
    })),
  }))
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export const estimatesApi = {
  async list(patientId: string): Promise<Estimate[]> {
    return toEstimates(await api.get(`/patients/${patientId}/estimates`))
  },
  async create(patientId: string, input: EstimateInput): Promise<Estimate[]> {
    return toEstimates(
      await api.post(`/patients/${patientId}/estimates`, {
        doctor_id: input.doctorId,
        valid_until: input.validUntil || null,
        notes: input.notes,
        discount_type: input.discountType,
        discount_value: input.discountValue,
        options: input.options.map((o) => ({
          label: o.label,
          items: o.items.map((i) => ({
            service_id: i.serviceId,
            teeth: i.teeth,
            sittings: i.sittings,
            unit_price_paise: i.unitPricePaise,
            quantity: i.quantity,
          })),
        })),
      }),
    )
  },
  async accept(id: string, optionId: string): Promise<Estimate[]> {
    return toEstimates(await api.post(`/estimates/${id}/accept`, { option_id: optionId }))
  },
  async decline(id: string): Promise<Estimate[]> {
    return toEstimates(await api.post(`/estimates/${id}/decline`))
  },
  pdf(id: string, download = false): Promise<FileDownload> {
    return api.file(`/estimates/${id}/pdf${download ? '?download=true' : ''}`)
  },
}
