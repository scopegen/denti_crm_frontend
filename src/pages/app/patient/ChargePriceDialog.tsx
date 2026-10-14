import { useState } from 'react'
import { Button } from '../../../components/Button'
import { ButtonRow } from '../../../components/ButtonRow'
import { Field } from '../../../components/Field'
import { Modal } from '../../../components/Modal'
import { ApiError } from '../../../lib/api'
import { billingApi, type Bill, type Charge } from '../../../lib/billingApi'
import { formatINR, paiseToRupeesInput, rupeesToPaise } from '../../../lib/money'
import { finalPrice, treatmentsApi, type AdjustmentType, type PriceInput } from '../../../lib/treatmentsApi'

// Changing what one charge on the bill costs: a consultation's fee or a treatment's price,
// with an increase and a discount (a percentage or an amount). Owner and receptionist only,
// from the Bill. The bill gets only the difference; what was billed before stays as it was.

const CHANGE_OPTIONS: { value: '' | AdjustmentType; label: string }[] = [
  { value: '', label: 'None' },
  { value: 'percent', label: 'Percent' },
  { value: 'amount', label: 'Amount (₹)' },
]

function ChangeField({
  label,
  type,
  value,
  onType,
  onValue,
}: {
  label: string
  type: '' | AdjustmentType
  value: string
  onType: (t: '' | AdjustmentType) => void
  onValue: (v: string) => void
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-body font-medium text-ink">{label}</span>
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2">
        <select
          aria-label={`${label} type`}
          value={type}
          onChange={(e) => onType(e.target.value as '' | AdjustmentType)}
          className="w-full rounded-lg border border-rule bg-white px-3.5 py-2.5 text-body text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent-tint"
        >
          {CHANGE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <input
          aria-label={label}
          inputMode="decimal"
          disabled={!type}
          value={type ? value : ''}
          onChange={(e) => onValue(e.target.value)}
          placeholder={type === 'percent' ? '10' : type === 'amount' ? '500' : ''}
          className="w-full rounded-lg border border-rule bg-white px-3.5 py-2.5 text-body text-ink outline-none placeholder:text-ink-faint focus:border-accent focus:ring-2 focus:ring-accent-tint disabled:bg-paper-raised"
        />
      </div>
    </div>
  )
}

/** "10" or "12.5" percent as basis points; an amount in rupees as paise. */
function toStored(type: '' | AdjustmentType, text: string): number | null {
  if (!type) return 0
  if (type === 'amount') return rupeesToPaise(text)
  if (!/^\d+(\.\d{1,2})?$/.test(text.trim())) return null
  return Math.round(Number(text) * 100)
}

function fromStored(type: AdjustmentType | null, value: number): string {
  if (!type || !value) return ''
  return type === 'amount' ? paiseToRupeesInput(value) : String(value / 100)
}

/** "Discount 10%, increase ₹500": how a charge differs from its price, if it does. */
export function describeCharge(c: Charge): string | null {
  const word = (type: AdjustmentType | null, value: number) => (type === 'percent' ? `${value / 100}%` : formatINR(value))
  const parts = [
    c.adjustmentType && c.adjustmentValue ? `increase ${word(c.adjustmentType, c.adjustmentValue)}` : null,
    c.discountType && c.discountValue ? `discount ${word(c.discountType, c.discountValue)}` : null,
  ].filter(Boolean)
  return parts.length ? parts.join(', ') : null
}

export function ChargePriceDialog({
  patientId,
  charge,
  onDone,
  onClose,
}: {
  patientId: string
  charge: Charge
  onDone: (bill: Bill) => void
  onClose: () => void
}) {
  const [price, setPrice] = useState(paiseToRupeesInput(charge.pricePaise))
  const [adjType, setAdjType] = useState<'' | AdjustmentType>(charge.adjustmentType ?? '')
  const [adjValue, setAdjValue] = useState(fromStored(charge.adjustmentType, charge.adjustmentValue))
  const [discType, setDiscType] = useState<'' | AdjustmentType>(charge.discountType ?? '')
  const [discValue, setDiscValue] = useState(fromStored(charge.discountType, charge.discountValue))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const pricePaise = rupeesToPaise(price)
  const adjustment = toStored(adjType, adjValue)
  const discount = toStored(discType, discValue)
  const input: PriceInput | null =
    pricePaise !== null && adjustment !== null && discount !== null
      ? { pricePaise, adjustmentType: adjType || null, adjustmentValue: adjustment, discountType: discType || null, discountValue: discount }
      : null
  const final = input ? finalPrice(input) : null
  const locked = charge.invoiceNumber !== null

  async function save() {
    if (!input) {
      setError('Check the amounts: rupees such as 6500, and percentages such as 10.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      if (charge.kind === 'consultation') {
        onDone(await billingApi.setConsultationFee(charge.id, input))
      } else {
        await treatmentsApi.setPrice(charge.id, input)
        onDone(await billingApi.bill(patientId))
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save the price.')
      setSaving(false)
    }
  }

  return (
    <Modal title={charge.kind === 'consultation' ? 'Consultation fee' : 'Treatment price'} wide onClose={onClose}>
      <p className="text-body text-ink">{charge.description}</p>
      {locked ? (
        <p className="rounded-lg bg-warn-soft px-3.5 py-2.5 text-body text-warn">
          This charge is on invoice {charge.invoiceNumber}. Cancel that invoice first, then change the price, and give a new invoice.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field
              label={charge.kind === 'consultation' ? 'Fee (₹)' : 'Price (₹)'}
              required
              inputMode="decimal"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              autoFocus
            />
            <ChangeField label="Increase" type={adjType} value={adjValue} onType={setAdjType} onValue={setAdjValue} />
            <ChangeField label="Discount" type={discType} value={discValue} onType={setDiscType} onValue={setDiscValue} />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-paper-raised px-3.5 py-2.5 text-body">
            <span className="text-ink-soft">
              Final: <span className="font-medium text-ink">{final === null ? 'Check the amounts' : formatINR(final)}</span>
            </span>
            {final !== null && final !== charge.billedPaise && (
              <span className="text-[13px] text-ink-soft">
                The bill {final > charge.billedPaise ? 'goes up' : 'comes down'} by {formatINR(Math.abs(final - charge.billedPaise))}.
              </span>
            )}
          </div>
          <p className="text-[12px] text-ink-faint">
            A discount of 100% makes it free. Everything already on the bill stays; the change is added as a new line.
          </p>
        </>
      )}
      {error && <p className="rounded-lg bg-crit-soft px-3.5 py-2.5 text-body text-crit">{error}</p>}
      <ButtonRow>
        <Button variant="ghost" onClick={onClose} disabled={saving}>
          {locked ? 'Close' : 'Cancel'}
        </Button>
        {!locked && (
          <Button onClick={save} disabled={saving || !input}>
            {saving ? 'Saving…' : 'Save price'}
          </Button>
        )}
      </ButtonRow>
    </Modal>
  )
}
