import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useOutletContext } from 'react-router-dom'
import { Button } from '../../../components/Button'
import { ButtonRow } from '../../../components/ButtonRow'
import { Field, SelectField } from '../../../components/Field'
import { Modal } from '../../../components/Modal'
import { Pill } from '../../../components/Pill'
import { ApiError } from '../../../lib/api'
import { billingApi, type Bill, type BillEntry } from '../../../lib/billingApi'
import { formatDate, todayInZone } from '../../../lib/date'
import { formatINR, rupeesToPaise } from '../../../lib/money'
import { useAuth } from '../../../state/AuthContext'
import type { PatientContext } from '../PatientDetail'
import { InvoicesPanel } from './InvoicesPanel'

// The Bill sheet on a patient's page, for the owner and receptionist. Everything the
// consultations and treatments put on the bill, with the running balance, and the money
// taken. A wrong payment is reversed with a reason, never edited. Amounts are shown without
// minus signs: payments read "Paid", discounts "Less", and the balance "due" or "credit".

type Dialog = null | 'payment' | 'refund' | 'opening' | { reverse: BillEntry }

export function balanceText(paise: number): string {
  if (paise > 0) return `${formatINR(paise)} due`
  if (paise < 0) return `${formatINR(-paise)} credit`
  return 'Nothing due'
}

export function BillSection() {
  const { patient } = useOutletContext<PatientContext>()
  const [bill, setBill] = useState<Bill | null>(null)
  const [dialog, setDialog] = useState<Dialog>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    billingApi
      .bill(patient.id)
      .then(setBill)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load the bill.'))
  }, [patient.id])

  useEffect(() => {
    load()
  }, [load])

  if (!bill) return error ? <p className="rounded-lg bg-crit-soft px-3.5 py-2.5 text-body text-crit">{error}</p> : <p className="text-ink-soft">Loading…</p>

  const due = bill.outstandingPaise
  const done = (updated: Bill) => {
    setBill(updated)
    setDialog(null)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-rule bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-1">
          <span className="text-[12px] font-medium uppercase tracking-wide text-ink-faint">{due < 0 ? 'Credit' : 'Outstanding'}</span>
          <span className={`text-[28px] font-bold leading-tight ${due > 0 ? 'text-crit' : due < 0 ? 'text-ok' : 'text-ink'}`}>
            {due === 0 ? 'Nothing due' : formatINR(Math.abs(due))}
          </span>
          <span className="text-[13px] text-ink-soft">
            Charged {formatINR(bill.chargedPaise)} · Paid {formatINR(bill.paidPaise)}
          </span>
        </div>
        <ButtonRow>
          {!bill.hasOpeningBalance && (
            <Button variant="ghost" onClick={() => setDialog('opening')}>
              Opening balance
            </Button>
          )}
          {due < 0 && (
            <Button variant="secondary" onClick={() => setDialog('refund')}>
              Refund
            </Button>
          )}
          <Button onClick={() => setDialog('payment')}>+ Take payment</Button>
        </ButtonRow>
      </div>

      <InvoicesPanel key={bill.entries.length} patientId={patient.id} />

      {bill.entries.length === 0 ? (
        <p className="text-body text-ink-soft">Nothing on the bill yet. Consultation fees and started treatments show here.</p>
      ) : (
        <div className="flex flex-col divide-y divide-rule rounded-xl border border-rule bg-white shadow-sm">
          {[...bill.entries].reverse().map((e) => (
            <EntryRow key={e.id} entry={e} onReverse={() => setDialog({ reverse: e })} />
          ))}
        </div>
      )}

      {dialog === 'payment' && (
        <PaymentDialog patientId={patient.id} bill={bill} onDone={done} onClose={() => setDialog(null)} />
      )}
      {dialog === 'refund' && <RefundDialog patientId={patient.id} bill={bill} onDone={done} onClose={() => setDialog(null)} />}
      {dialog === 'opening' && <OpeningDialog patientId={patient.id} onDone={done} onClose={() => setDialog(null)} />}
      {typeof dialog === 'object' && dialog !== null && (
        <ReverseDialog entry={dialog.reverse} onDone={done} onClose={() => setDialog(null)} />
      )}
    </div>
  )
}

function amountText(e: BillEntry): { text: string; tone: string } {
  const amount = formatINR(Math.abs(e.amountPaise))
  switch (e.kind) {
    case 'payment':
      return { text: `Paid ${amount}`, tone: 'text-ok' }
    case 'payment_reversal':
      return { text: `Reversed ${amount}`, tone: 'text-crit' }
    case 'refund':
      return { text: `Refunded ${amount}`, tone: 'text-ink' }
    default:
      return e.amountPaise < 0 ? { text: `Less ${amount}`, tone: 'text-ok' } : { text: amount, tone: 'text-ink' }
  }
}

function EntryRow({ entry: e, onReverse }: { entry: BillEntry; onReverse: () => void }) {
  const { clinic } = useAuth()
  const amount = amountText(e)
  const meta = [formatDate(e.effectiveAt, clinic?.timezone), e.kind === 'payment' || e.kind === 'refund' ? `by ${e.createdBy.name}` : null]
    .filter(Boolean)
    .join(' · ')
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 px-4 py-3">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="flex flex-wrap items-center gap-2 text-body text-ink">
          {e.description}
          {e.reversed && <Pill variant="crit">Reversed</Pill>}
        </span>
        <span className="text-[12px] text-ink-faint">
          {meta}
          {e.note && e.kind !== 'price_change' ? ` · ${e.note}` : ''}
        </span>
      </div>
      <div className="ml-auto flex items-center gap-4">
        {e.kind === 'payment' && !e.reversed && (
          <ButtonRow>
            <Button variant="ghost" className="!px-2.5 !py-1 text-[13px]" onClick={onReverse}>
              Reverse
            </Button>
          </ButtonRow>
        )}
        <div className="flex flex-col items-end">
          <span className={`text-body font-medium tabular-nums ${amount.tone} ${e.reversed ? 'line-through opacity-60' : ''}`}>{amount.text}</span>
          <span className="text-[12px] tabular-nums text-ink-faint">{balanceText(e.balancePaise)}</span>
        </div>
      </div>
    </div>
  )
}

function ModeButtons({ modes, value, onChange }: { modes: string[]; value: string; onChange: (m: string) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-body font-medium text-ink">Paid by</span>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Paid by">
        {modes.map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={value === m}
            onClick={() => onChange(m)}
            className={`rounded-lg border px-4 py-2 text-body font-medium transition-colors ${
              value === m ? 'border-accent bg-accent-tint text-accent-deep' : 'border-rule bg-white text-ink-soft hover:text-ink'
            }`}
          >
            {m}
          </button>
        ))}
      </div>
    </div>
  )
}

function useSubmit(onDone: (b: Bill) => void) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function submit(action: () => Promise<Bill>) {
    setSaving(true)
    setError(null)
    try {
      onDone(await action())
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save. Please try again.')
      setSaving(false)
    }
  }
  return { saving, error, setError, submit }
}

function DialogError({ error }: { error: string | null }): ReactNode {
  return error ? <p className="rounded-lg bg-crit-soft px-3.5 py-2.5 text-body text-crit">{error}</p> : null
}

function PaymentDialog({ patientId, bill, onDone, onClose }: { patientId: string; bill: Bill; onDone: (b: Bill) => void; onClose: () => void }) {
  const { clinic } = useAuth()
  const today = todayInZone(clinic?.timezone)
  const due = Math.max(bill.outstandingPaise, 0)
  const [amount, setAmount] = useState(due > 0 ? String(due / 100) : '')
  const [mode, setMode] = useState(bill.paymentModes[0] ?? '')
  const [paidOn, setPaidOn] = useState(today)
  const [note, setNote] = useState('')
  const { saving, error, setError, submit } = useSubmit(onDone)

  function save() {
    const paise = rupeesToPaise(amount)
    if (!paise) {
      setError('Enter the amount in rupees, such as 3000.')
      return
    }
    submit(() => billingApi.pay(patientId, { amountPaise: paise, mode, paidOn, note }))
  }

  return (
    <Modal title="Take payment" onClose={onClose}>
      {due > 0 && <p className="text-[13px] text-ink-soft">{formatINR(due)} is due.</p>}
      <Field label="Amount (₹)" required inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
      <ModeButtons modes={bill.paymentModes} value={mode} onChange={setMode} />
      <Field label="Date" type="date" required max={today} value={paidOn} onChange={(e) => setPaidOn(e.target.value)} />
      <Field label="Note" hint="Optional" value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} placeholder="UPI reference" />
      <DialogError error={error} />
      <ButtonRow>
        <Button variant="ghost" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={save} disabled={saving || !mode}>
          {saving ? 'Saving…' : 'Save payment'}
        </Button>
      </ButtonRow>
    </Modal>
  )
}

function RefundDialog({ patientId, bill, onDone, onClose }: { patientId: string; bill: Bill; onDone: (b: Bill) => void; onClose: () => void }) {
  const credit = Math.max(-bill.outstandingPaise, 0)
  const [amount, setAmount] = useState(String(credit / 100))
  const [mode, setMode] = useState(bill.paymentModes[0] ?? '')
  const [note, setNote] = useState('')
  const { saving, error, setError, submit } = useSubmit(onDone)

  function save() {
    const paise = rupeesToPaise(amount)
    if (!paise) {
      setError('Enter the amount in rupees.')
      return
    }
    submit(() => billingApi.refund(patientId, { amountPaise: paise, mode, note }))
  }

  return (
    <Modal title="Refund" onClose={onClose}>
      <p className="text-[13px] text-ink-soft">The patient has {formatINR(credit)} in credit. A refund hands some or all of it back.</p>
      <Field label="Amount (₹)" required inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
      <ModeButtons modes={bill.paymentModes} value={mode} onChange={setMode} />
      <Field label="Note" hint="Optional" value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} />
      <DialogError error={error} />
      <ButtonRow>
        <Button variant="ghost" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={save} disabled={saving || !mode}>
          {saving ? 'Saving…' : 'Save refund'}
        </Button>
      </ButtonRow>
    </Modal>
  )
}

const OWED = 'Owed to the clinic'
const CREDIT = 'Credit held for the patient'

function OpeningDialog({ patientId, onDone, onClose }: { patientId: string; onDone: (b: Bill) => void; onClose: () => void }) {
  const [amount, setAmount] = useState('')
  const [direction, setDirection] = useState(OWED)
  const [note, setNote] = useState('')
  const { saving, error, setError, submit } = useSubmit(onDone)

  function save() {
    const paise = rupeesToPaise(amount)
    if (!paise) {
      setError('Enter the amount in rupees.')
      return
    }
    submit(() => billingApi.openingBalance(patientId, direction === OWED ? paise : -paise, note))
  }

  return (
    <Modal title="Opening balance" onClose={onClose}>
      <p className="text-[13px] text-ink-soft">
        For a patient moving from your old software or paper records: what they owed, or had in credit, on the day you started with
        Denti. It can be added once.
      </p>
      <Field label="Amount (₹)" required inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
      <SelectField label="This is" options={[OWED, CREDIT]} value={direction} onChange={(e) => setDirection(e.target.value)} />
      <Field label="Note" hint="Optional" value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} placeholder="Balance from old records" />
      <DialogError error={error} />
      <ButtonRow>
        <Button variant="ghost" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Add opening balance'}
        </Button>
      </ButtonRow>
    </Modal>
  )
}

function ReverseDialog({ entry, onDone, onClose }: { entry: BillEntry; onDone: (b: Bill) => void; onClose: () => void }) {
  const { clinic } = useAuth()
  const [reason, setReason] = useState('')
  const { saving, error, submit } = useSubmit(onDone)
  return (
    <Modal title="Reverse this payment?" onClose={onClose}>
      <p className="text-body text-ink-soft">
        {formatINR(Math.abs(entry.amountPaise))} by {entry.paymentMode} on {formatDate(entry.effectiveAt, clinic?.timezone)} stays on the
        bill, marked reversed, and the balance goes back up. Then take the right payment.
      </p>
      <Field label="Why" required value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} placeholder="Entered twice" />
      <DialogError error={error} />
      <ButtonRow>
        <Button variant="ghost" onClick={onClose} disabled={saving}>
          Keep payment
        </Button>
        <Button variant="danger" onClick={() => submit(() => billingApi.reverse(entry.id, reason))} disabled={saving || !reason.trim()}>
          {saving ? 'Reversing…' : 'Reverse payment'}
        </Button>
      </ButtonRow>
    </Modal>
  )
}
