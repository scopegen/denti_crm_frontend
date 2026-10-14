import { api, type FileDownload } from './api'
import type { Person } from './todayApi'
import type { AdjustmentType, PriceInput } from './treatmentsApi'

// The patient's bill and the clinic's dues, for the owner and receptionist: every call, and
// the snake_case to camelCase conversion. Amounts are whole paise; positive means owed.

export type EntryKind =
  | 'consultation_fee'
  | 'treatment_charge'
  | 'price_change'
  | 'opening_balance'
  | 'payment'
  | 'payment_reversal'
  | 'refund'

export interface BillEntry {
  id: string
  kind: EntryKind
  amountPaise: number
  effectiveAt: string
  description: string
  paymentMode: string | null
  note: string | null
  reversesEntryId: string | null
  reversed: boolean
  createdBy: Person
  balancePaise: number
  consultationId: string | null
  treatmentId: string | null
}

/** A consultation fee or started treatment on the bill, and how its price is made up. */
export interface Charge {
  kind: 'consultation' | 'treatment'
  id: string
  description: string
  on: string | null
  pricePaise: number
  adjustmentType: AdjustmentType | null
  adjustmentValue: number
  discountType: AdjustmentType | null
  discountValue: number
  finalPaise: number
  billedPaise: number
  /** The issued invoice it is on: its price is locked until that invoice is cancelled. */
  invoiceNumber: string | null
}

export interface Bill {
  /** Positive: the patient owes this. Negative: credit held for the patient. */
  outstandingPaise: number
  chargedPaise: number
  paidPaise: number
  entries: BillEntry[]
  charges: Charge[]
  hasOpeningBalance: boolean
  paymentModes: string[]
}

export interface DueRow {
  patient: { id: string; code: string; name: string; phone: string }
  outstandingPaise: number
  lastPaymentAt: string | null
  lastChargeAt: string | null
}

export interface Dues {
  totalPaise: number
  count: number
  items: DueRow[]
  page: number
  pageSize: number
}

export interface InvoiceableItem {
  kind: 'consultation' | 'treatment'
  id: string
  description: string
  teeth: number[]
  on: string
  amountPaise: number
}

export interface Invoice {
  id: string
  numberText: string
  issuedOn: string
  issuedBy: Person
  totalPaise: number
  status: 'issued' | 'cancelled'
  cancelReason: string | null
  lines: { description: string; teeth: number[]; amountPaise: number }[]
}

export interface Invoices {
  invoices: Invoice[]
  invoiceable: InvoiceableItem[]
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function toInvoices(raw: any): Invoices {
  return {
    invoices: raw.invoices.map((i: any) => ({
      id: i.id,
      numberText: i.number_text,
      issuedOn: i.issued_on,
      issuedBy: i.issued_by,
      totalPaise: i.total_paise,
      status: i.status,
      cancelReason: i.cancel_reason,
      lines: i.lines.map((l: any) => ({ description: l.description, teeth: l.teeth, amountPaise: l.amount_paise })),
    })),
    invoiceable: raw.invoiceable.map((i: any) => ({
      kind: i.kind,
      id: i.id,
      description: i.description,
      teeth: i.teeth,
      on: i.on,
      amountPaise: i.amount_paise,
    })),
  }
}

function toBill(raw: any): Bill {
  return {
    outstandingPaise: raw.outstanding_paise,
    chargedPaise: raw.charged_paise,
    paidPaise: raw.paid_paise,
    entries: raw.entries.map((e: any) => ({
      id: e.id,
      kind: e.kind,
      amountPaise: e.amount_paise,
      effectiveAt: e.effective_at,
      description: e.description,
      paymentMode: e.payment_mode,
      note: e.note,
      reversesEntryId: e.reverses_entry_id,
      reversed: e.reversed,
      createdBy: e.created_by,
      balancePaise: e.balance_paise,
      consultationId: e.consultation_id,
      treatmentId: e.treatment_id,
    })),
    charges: raw.charges.map((c: any) => ({
      kind: c.kind,
      id: c.id,
      description: c.description,
      on: c.on,
      pricePaise: c.price_paise,
      adjustmentType: c.adjustment_type,
      adjustmentValue: c.adjustment_value,
      discountType: c.discount_type,
      discountValue: c.discount_value,
      finalPaise: c.final_paise,
      billedPaise: c.billed_paise,
      invoiceNumber: c.invoice_number,
    })),
    hasOpeningBalance: raw.has_opening_balance,
    paymentModes: raw.payment_modes,
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export const billingApi = {
  async bill(patientId: string): Promise<Bill> {
    return toBill(await api.get(`/patients/${patientId}/bill`))
  },
  /** A consultation's fee, increase and discount. The bill gets only the difference. */
  async setConsultationFee(consultationId: string, input: PriceInput): Promise<Bill> {
    return toBill(
      await api.put(`/consultations/${consultationId}/fee`, {
        price_paise: input.pricePaise,
        adjustment_type: input.adjustmentType,
        adjustment_value: input.adjustmentValue,
        discount_type: input.discountType,
        discount_value: input.discountValue,
      }),
    )
  },
  async pay(patientId: string, input: { amountPaise: number; mode: string; paidOn: string; note: string }): Promise<Bill> {
    return toBill(
      await api.post(`/patients/${patientId}/payments`, {
        amount_paise: input.amountPaise,
        payment_mode: input.mode,
        paid_on: input.paidOn || null,
        note: input.note,
      }),
    )
  },
  async reverse(entryId: string, reason: string): Promise<Bill> {
    return toBill(await api.post(`/ledger/${entryId}/reverse`, { reason }))
  },
  async refund(patientId: string, input: { amountPaise: number; mode: string; note: string }): Promise<Bill> {
    return toBill(
      await api.post(`/patients/${patientId}/refunds`, { amount_paise: input.amountPaise, payment_mode: input.mode, note: input.note }),
    )
  },
  async openingBalance(patientId: string, amountPaise: number, note: string): Promise<Bill> {
    return toBill(await api.post(`/patients/${patientId}/opening-balance`, { amount_paise: amountPaise, note }))
  },
  async invoices(patientId: string): Promise<Invoices> {
    return toInvoices(await api.get(`/patients/${patientId}/invoices`))
  },
  async createInvoice(patientId: string, items: InvoiceableItem[]): Promise<Invoices> {
    return toInvoices(
      await api.post(`/patients/${patientId}/invoices`, {
        consultation_ids: items.filter((i) => i.kind === 'consultation').map((i) => i.id),
        treatment_ids: items.filter((i) => i.kind === 'treatment').map((i) => i.id),
      }),
    )
  },
  async cancelInvoice(id: string, reason: string): Promise<Invoices> {
    return toInvoices(await api.post(`/invoices/${id}/cancel`, { reason }))
  },
  invoicePdf(id: string, download = false): Promise<FileDownload> {
    return api.file(`/invoices/${id}/pdf${download ? '?download=true' : ''}`)
  },
  async dues(q: string, page: number): Promise<Dues> {
    const params = new URLSearchParams({ page: String(page) })
    if (q.trim()) params.set('q', q.trim())
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    const raw = await api.get<any>(`/dues?${params}`)
    return {
      totalPaise: raw.total_paise,
      count: raw.count,
      page: raw.page,
      pageSize: raw.page_size,
      items: raw.items.map((d: any) => ({
        patient: { id: d.patient.id, code: d.patient.code, name: d.patient.name, phone: d.patient.phone },
        outstandingPaise: d.outstanding_paise,
        lastPaymentAt: d.last_payment_at,
        lastChargeAt: d.last_charge_at,
      })),
    }
  },
}
