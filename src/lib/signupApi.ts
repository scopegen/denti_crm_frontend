import { api } from './api'
import type { PlanKey, PlanOption } from './planApi'

// A clinic signing up by itself: plans, checking a web address, then the emailed code.

export interface SignupPlans {
  plans: PlanOption[]
  features: { label: string; plans: PlanKey[] }[]
  starterPackMonths: number
  gstPercent: number
}

export interface SignupDetails {
  plan: PlanKey
  clinicName: string
  slug: string
  patientIdPrefix: string
  ownerName: string
  email: string
  phone: string
  password: string
  ownerTreatsPatients: boolean
}

export interface SignupStarted {
  signupId: string
  sentTo: string
  resendAfterSeconds: number
  amountPaise: number
  gstPaise: number
  totalPaise: number
  /** "test": no money is taken. "none": the clinic pays the Denti team directly for now. */
  paymentMethod: string
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function toStarted(raw: any): SignupStarted {
  return {
    signupId: raw.signup_id,
    sentTo: raw.sent_to,
    resendAfterSeconds: raw.resend_after_seconds,
    amountPaise: raw.amount_paise,
    gstPaise: raw.gst_paise,
    totalPaise: raw.total_paise,
    paymentMethod: raw.payment_method,
  }
}

export const signupApi = {
  async plans(): Promise<SignupPlans> {
    const raw = await api.get<any>('/signup/plans')
    return {
      plans: raw.plans.map((p: any) => ({
        key: p.key,
        name: p.name,
        receptionists: p.receptionists,
        doctors: p.doctors,
        patients: p.patients,
        storageGb: p.storage_gb,
        starterPackPaise: p.starter_pack_paise,
        monthlyPaise: p.monthly_paise,
        yearlyPaise: p.yearly_paise,
      })),
      features: raw.features,
      starterPackMonths: raw.starter_pack_months,
      gstPercent: raw.gst_percent,
    }
  },
  async checkAddress(slug: string): Promise<{ available: boolean; reason: string | null }> {
    return api.get(`/signup/address?slug=${encodeURIComponent(slug)}`)
  },
  async start(d: SignupDetails): Promise<SignupStarted> {
    return toStarted(
      await api.post('/signup', {
        plan: d.plan,
        clinic_name: d.clinicName,
        slug: d.slug,
        patient_id_prefix: d.patientIdPrefix || null,
        owner_name: d.ownerName,
        email: d.email,
        phone: d.phone || null,
        password: d.password,
        owner_treats_patients: d.ownerTreatsPatients,
      }),
    )
  },
  async resend(signupId: string): Promise<SignupStarted> {
    return toStarted(await api.post(`/signup/${signupId}/resend`))
  },
  /** The right code creates the clinic and signs the owner in. */
  async verify(signupId: string, code: string): Promise<{ clinicSlug: string; paid: boolean }> {
    const raw = await api.post<any>(`/signup/${signupId}/verify`, { code })
    return { clinicSlug: raw.clinic_slug, paid: raw.paid }
  },
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** "Bright Smiles Dental" gives "bright-smiles-dental". */
export function slugFrom(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '')
}

/** "bright-smiles-dental" gives "BRIGHT", as patient IDs like BRIGHT-0001. */
export function prefixFrom(slug: string): string {
  return slug.split('-')[0].replace(/[^a-z0-9]/g, '').slice(0, 6).toUpperCase()
}
