import { api } from './api'

// Every patient call the app makes, and the conversion from the API's snake_case to camelCase.
// This is the one file that knows the exact shape the backend sends for patients.

export type Gender = 'male' | 'female' | 'other'

export interface Patient {
  id: string
  patientNumber: number
  code: string
  name: string
  phone: string
  email: string | null
  gender: Gender | null
  dob: string | null
  birthYear: number | null
  city: string | null
  area: string | null
  heightCm: number | null
  weightKg: number | null
  medicalConditions: string[]
  medicalHistory: string | null
  whatsappConsent: boolean
  registeredAt: string
}

export interface PatientSummary {
  id: string
  patientNumber: number
  code: string
  name: string
  phone: string
  gender: Gender | null
  dob: string | null
  birthYear: number | null
  medicalConditions: string[]
  registeredAt: string
}

export interface PatientInput {
  name: string
  phone: string
  email: string
  gender: Gender | null
  dob: string | null
  birthYear: number | null
  city: string
  area: string
  heightCm: number | null
  weightKg: number | null
  medicalConditions: string[]
  medicalHistory: string
  whatsappConsent: boolean
}

export interface PatientPage {
  items: PatientSummary[]
  total: number
  page: number
  pageSize: number
}

export interface PatientStats {
  total: number
  newThisMonth: number
  used: number
  limit: number | null
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function toPatient(raw: any): Patient {
  return {
    id: raw.id,
    patientNumber: raw.patient_number,
    code: raw.code,
    name: raw.name,
    phone: raw.phone,
    email: raw.email,
    gender: raw.gender,
    dob: raw.dob,
    birthYear: raw.birth_year,
    city: raw.city,
    area: raw.area,
    heightCm: raw.height_cm,
    weightKg: raw.weight_kg,
    medicalConditions: raw.medical_conditions,
    medicalHistory: raw.medical_history,
    whatsappConsent: raw.whatsapp_consent,
    registeredAt: raw.registered_at,
  }
}

function toSummary(raw: any): PatientSummary {
  return {
    id: raw.id,
    patientNumber: raw.patient_number,
    code: raw.code,
    name: raw.name,
    phone: raw.phone,
    gender: raw.gender,
    dob: raw.dob,
    birthYear: raw.birth_year,
    medicalConditions: raw.medical_conditions,
    registeredAt: raw.registered_at,
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

function toPayload(input: PatientInput) {
  return {
    name: input.name,
    phone: input.phone,
    email: input.email,
    gender: input.gender,
    dob: input.dob,
    birth_year: input.birthYear,
    city: input.city,
    area: input.area,
    height_cm: input.heightCm,
    weight_kg: input.weightKg,
    medical_conditions: input.medicalConditions,
    medical_history: input.medicalHistory,
    whatsapp_consent: input.whatsappConsent,
  }
}

export const patientsApi = {
  async list(q: string, page: number, pageSize = 25): Promise<PatientPage> {
    const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) })
    if (q.trim()) params.set('q', q.trim())
    const raw = await api.get<{ items: unknown[]; total: number; page: number; page_size: number }>(`/patients?${params}`)
    return { items: raw.items.map(toSummary), total: raw.total, page: raw.page, pageSize: raw.page_size }
  },

  async stats(): Promise<PatientStats> {
    const raw = await api.get<{ total: number; new_this_month: number; used: number; limit: number | null }>('/patients/stats')
    return { total: raw.total, newThisMonth: raw.new_this_month, used: raw.used, limit: raw.limit }
  },

  async get(code: string): Promise<Patient> {
    return toPatient(await api.get(`/patients/${encodeURIComponent(code)}`))
  },

  async create(input: PatientInput, allowDuplicatePhone = false): Promise<Patient> {
    return toPatient(await api.post('/patients', { ...toPayload(input), allow_duplicate_phone: allowDuplicatePhone }))
  },

  async update(id: string, input: PatientInput): Promise<Patient> {
    return toPatient(await api.patch(`/patients/${id}`, toPayload(input)))
  },

  picklist(list: 'medical_condition' | 'city'): Promise<string[]> {
    return api.get<string[]>(`/picklists/${list}`)
  },
}

export const GENDER_LABEL: Record<Gender, string> = { male: 'Male', female: 'Female', other: 'Other' }
