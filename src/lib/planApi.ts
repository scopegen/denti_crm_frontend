import { api } from './api'

// The clinic's plan, how much of it is used, and what every plan includes.

export type PlanKey = 'basic' | 'standard' | 'pro'

/** How much of a limit is used. A null limit means unlimited on this plan. */
export interface Meter {
  used: number
  limit: number | null
}

export interface Billing {
  billingCycle: 'starter' | 'monthly' | 'yearly'
  status: string
  currentPeriodStart: string
  currentPeriodEnd: string
  storageAddonPacks: number
}

export interface PlanOption {
  key: PlanKey
  name: string
  receptionists: number | null
  doctors: number | null
  patients: number | null
  storageGb: number
  starterPackPaise: number
  monthlyPaise: number
  yearlyPaise: number
}

export interface PlanChange {
  id: string
  kind: 'upgrade' | 'downgrade'
  fromPlan: PlanKey
  fromPlanName: string
  toPlan: PlanKey
  toPlanName: string
  status: 'pending' | 'applied' | 'cancelled'
  effectiveAt: string
  totalPaise: number
  requestedBy: { id: string; name: string }
}

export interface SeatChoice {
  role: 'admin' | 'doctor'
  limit: number
  active: { id: string; name: string }[]
  suggestedKeep: string[]
}

/** What moving to another plan would cost and change. */
export interface PlanChangePreview {
  toPlan: PlanKey
  toPlanName: string
  kind: 'upgrade' | 'downgrade'
  effectiveAt: string
  amountPaise: number
  gstPaise: number
  totalPaise: number
  nextPricePaise: number
  nextBillingCycle: 'monthly' | 'yearly'
  gained: string[]
  lost: string[]
  seats: SeatChoice[]
  patients: Meter | null
  storageBytes: Meter | null
  /** "test": online payment is not connected yet, so no money is taken. */
  paymentMethod: string
}

export interface PlanInfo {
  plan: PlanKey
  planName: string
  billing: Billing | null
  pendingChange: PlanChange | null
  /** Only the owner changes the plan. */
  canChange: boolean
  usage: { patients: Meter; receptionists: Meter; doctors: Meter; storageBytes: Meter }
  plans: PlanOption[]
  features: { label: string; plans: PlanKey[] }[]
  starterPackMonths: number
  storagePackGb: number
  storagePackMonthlyPaise: number
  gstPercent: number
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function toPlanInfo(raw: any): PlanInfo {
  return {
    plan: raw.plan,
    planName: raw.plan_name,
    pendingChange: raw.pending_change
      ? {
          id: raw.pending_change.id,
          kind: raw.pending_change.kind,
          fromPlan: raw.pending_change.from_plan,
          fromPlanName: raw.pending_change.from_plan_name,
          toPlan: raw.pending_change.to_plan,
          toPlanName: raw.pending_change.to_plan_name,
          status: raw.pending_change.status,
          effectiveAt: raw.pending_change.effective_at,
          totalPaise: raw.pending_change.total_paise,
          requestedBy: raw.pending_change.requested_by,
        }
      : null,
    canChange: raw.can_change,
    billing: raw.billing
      ? {
          billingCycle: raw.billing.billing_cycle,
          status: raw.billing.status,
          currentPeriodStart: raw.billing.current_period_start,
          currentPeriodEnd: raw.billing.current_period_end,
          storageAddonPacks: raw.billing.storage_addon_packs,
        }
      : null,
    usage: {
      patients: raw.usage.patients,
      receptionists: raw.usage.receptionists,
      doctors: raw.usage.doctors,
      storageBytes: raw.usage.storage_bytes,
    },
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
    storagePackGb: raw.storage_pack_gb,
    storagePackMonthlyPaise: raw.storage_pack_monthly_paise,
    gstPercent: raw.gst_percent,
  }
}
function toPreview(raw: any): PlanChangePreview {
  return {
    toPlan: raw.to_plan,
    toPlanName: raw.to_plan_name,
    kind: raw.kind,
    effectiveAt: raw.effective_at,
    amountPaise: raw.amount_paise,
    gstPaise: raw.gst_paise,
    totalPaise: raw.total_paise,
    nextPricePaise: raw.next_price_paise,
    nextBillingCycle: raw.next_billing_cycle,
    gained: raw.gained,
    lost: raw.lost,
    seats: raw.seats.map((s: any) => ({ role: s.role, limit: s.limit, active: s.active, suggestedKeep: s.suggested_keep })),
    patients: raw.patients,
    storageBytes: raw.storage_bytes,
    paymentMethod: raw.payment_method,
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export const planApi = {
  async get(): Promise<PlanInfo> {
    return toPlanInfo(await api.get('/plan'))
  },
  async preview(to: PlanKey): Promise<PlanChangePreview> {
    return toPreview(await api.get(`/plan/changes/preview?to=${to}`))
  },
  /** Moving up applies now; moving down is scheduled for the end of the paid period. */
  async change(to: PlanKey, keepStaffIds: string[]): Promise<PlanInfo> {
    return toPlanInfo(await api.post('/plan/changes', { to_plan: to, keep_staff_ids: keepStaffIds }))
  },
  async cancel(changeId: string): Promise<PlanInfo> {
    return toPlanInfo(await api.post(`/plan/changes/${changeId}/cancel`))
  },
}

const GB = 1024 ** 3
const MB = 1024 ** 2

/** "0 MB", "340 MB", "1.2 GB", "15 GB". */
export function formatBytes(bytes: number): string {
  if (bytes >= GB) {
    const gb = bytes / GB
    return `${gb >= 10 || Number.isInteger(gb) ? Math.round(gb) : gb.toFixed(1)} GB`
  }
  return `${Math.ceil(bytes / MB)} MB`
}
