// Shapes of what the API sends back for signing in, in the app's own camelCase.

export type StaffRole = 'owner' | 'admin' | 'doctor'

export interface Staff {
  id: string
  name: string
  email: string
  phone: string | null
  role: StaffRole
  treatsPatients: boolean
  qualification: string | null
  specialty: string | null
  registrationNo: string | null
  status: string
  hasSignature: boolean
}

export interface Clinic {
  id: string
  slug: string
  name: string
  plan: 'basic' | 'standard' | 'pro'
  timezone: string
}

export interface RawStaff {
  id: string
  name: string
  email: string
  phone: string | null
  role: StaffRole
  treats_patients: boolean
  qualification: string | null
  specialty: string | null
  registration_no: string | null
  status: string
  has_signature: boolean
}

export interface RawSession {
  access_token: string
  staff: RawStaff
  clinic: Clinic
}

export interface RawLoginResponse {
  status: 'code_sent' | 'signed_in'
  challenge_id: string | null
  sent_to: string | null
  resend_after_seconds: number | null
  session: RawSession | null
}

export function toStaff(raw: RawStaff): Staff {
  return {
    id: raw.id,
    name: raw.name,
    email: raw.email,
    phone: raw.phone,
    role: raw.role,
    treatsPatients: raw.treats_patients,
    qualification: raw.qualification,
    specialty: raw.specialty,
    registrationNo: raw.registration_no,
    status: raw.status,
    hasSignature: raw.has_signature,
  }
}

export const ROLE_LABEL: Record<StaffRole, string> = {
  owner: 'Owner',
  admin: 'Receptionist',
  doctor: 'Doctor',
}
