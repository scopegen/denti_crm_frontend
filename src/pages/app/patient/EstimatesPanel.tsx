import { useCallback, useEffect, useState } from 'react'
import { Download, Eye, X } from 'lucide-react'
import { Button } from '../../../components/Button'
import { ButtonRow } from '../../../components/ButtonRow'
import { Field, TextareaField } from '../../../components/Field'
import { Modal } from '../../../components/Modal'
import { Pill } from '../../../components/Pill'
import { WhatsAppButton } from '../../../components/WhatsAppButton'
import { ApiError } from '../../../lib/api'
import { parseTeeth } from '../../../lib/clinicalApi'
import { formatDate, todayInZone } from '../../../lib/date'
import { ESTIMATE_STATUS_LABEL, estimatesApi, type Estimate, type EstimateStatus } from '../../../lib/estimatesApi'
import { saveFile, viewFile } from '../../../lib/files'
import { formatINR, paiseToRupeesInput, rupeesToPaise } from '../../../lib/money'
import type { Service } from '../../../lib/settingsApi'
import type { Person } from '../../../lib/todayApi'
import { finalPrice, type AdjustmentType, type Suggestion, type Treatment } from '../../../lib/treatmentsApi'
import { useAuth } from '../../../state/AuthContext'
import { DoctorSelect, ServiceSelect, useDefaultDoctor } from './clinicalParts'

// Estimates at the top of the Treatments sheet. The owner or receptionist gives one, with one
// or more options, filled from the doctor's recommendations and planned treatments or any
// service; prints it; and marks it accepted (its items become planned treatments at the
// quoted prices) or declined. Doctors see the estimates and their status, never amounts.

const PILL: Record<EstimateStatus, 'accent' | 'success' | 'crit' | 'outline'> = {
  given: 'accent',
  accepted: 'success',
  declined: 'crit',
  expired: 'outline',
}
const small = '!px-2.5 !py-1 text-[13px]'

export function EstimatesPanel({
  patientId,
  services,
  doctors,
  suggestions,
  treatments,
  showTeeth,
  onAccepted,
}: {
  patientId: string
  services: Service[]
  doctors: Person[]
  suggestions: Suggestion[]
  treatments: Treatment[]
  showTeeth: boolean
  onAccepted: () => void
}) {
  const { staff } = useAuth()
  const isAdmin = staff?.role === 'owner' || staff?.role === 'admin'
  const [estimates, setEstimates] = useState<Estimate[] | null>(null)
  const [creating, setCreating] = useState(false)
  const [accepting, setAccepting] = useState<Estimate | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    estimatesApi
      .list(patientId)
      .then(setEstimates)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load the estimates.'))
  }, [patientId])

  useEffect(() => {
    load()
  }, [load])

  async function run(action: () => Promise<Estimate[]>) {
    setError(null)
    try {
      setEstimates(await action())
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.')
    }
  }

  async function open(estimate: Estimate, download: boolean) {
    setError(null)
    try {
      if (download) await saveFile(() => estimatesApi.pdf(estimate.id, true), 'Estimate.pdf')
      else await viewFile(() => estimatesApi.pdf(estimate.id))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not open the estimate.')
    }
  }

  if (!estimates) return null
  if (!isAdmin && estimates.length === 0) return null

  return (
    <section aria-label="Estimates" className="flex flex-col gap-3 rounded-xl border border-rule bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-body font-medium text-ink">Estimates</span>
        {isAdmin && !creating && (
          <ButtonRow>
            <Button variant="secondary" className="!px-3 !py-1.5 text-[13px]" onClick={() => setCreating(true)}>
              + New estimate
            </Button>
          </ButtonRow>
        )}
      </div>
      {error && <p className="rounded-lg bg-crit-soft px-3.5 py-2.5 text-body text-crit">{error}</p>}

      {creating && (
        <EstimateForm
          patientId={patientId}
          services={services}
          doctors={doctors}
          suggestions={suggestions}
          treatments={treatments}
          showTeeth={showTeeth}
          onSaved={(list) => {
            setEstimates(list)
            setCreating(false)
          }}
          onCancel={() => setCreating(false)}
        />
      )}

      {estimates.length === 0 && !creating && (
        <p className="text-[13px] text-ink-faint">No estimates yet. Give one to show the patient the cost before starting.</p>
      )}
      {estimates.map((e) => (
        <div key={e.id} className="flex flex-col gap-2 rounded-lg border border-rule px-3.5 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex flex-wrap items-center gap-2 text-body text-ink">
              <span className="font-mono text-[13px]">{e.numberText}</span>
              <Pill variant={PILL[e.status]}>{ESTIMATE_STATUS_LABEL[e.status]}</Pill>
            </span>
            <span className="text-[12px] text-ink-faint">
              {formatDate(e.givenOn)} · valid until {formatDate(e.validUntil)} · {e.doctor.name}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            {e.options.map((o) => (
              <div key={o.id} className="flex flex-wrap items-baseline justify-between gap-2 text-[13px]">
                <span className={`text-ink-soft ${e.acceptedOptionId === o.id ? 'font-medium text-ok' : ''}`}>
                  {e.options.length > 1 ? `${o.label}: ` : ''}
                  {o.items.map((i) => (i.teeth.length ? `${i.description} (${i.teeth.join(', ')})` : i.description)).join(', ')}
                  {e.acceptedOptionId === o.id ? ' · chosen' : ''}
                </span>
                {o.totalPaise !== null && <span className="tabular-nums text-ink">{formatINR(o.totalPaise)}</span>}
              </div>
            ))}
          </div>
          {isAdmin && (
            <ButtonRow className="!gap-1.5">
              {(e.status === 'given' || e.status === 'expired') && (
                <>
                  <Button variant="ghost" className={small} onClick={() => run(() => estimatesApi.decline(e.id))}>
                    Declined
                  </Button>
                  <Button variant="secondary" className={small} onClick={() => setAccepting(e)}>
                    Accepted
                  </Button>
                </>
              )}
              <Button variant="ghost" className={`flex items-center gap-1.5 ${small}`} onClick={() => open(e, true)}>
                <Download size={14} /> Download
              </Button>
              <WhatsAppButton className={small} message={{ patientId, kind: 'estimate', estimateId: e.id }} />
              <Button variant="tint" className={`flex items-center gap-1.5 ${small}`} onClick={() => open(e, false)}>
                <Eye size={14} /> View PDF
              </Button>
            </ButtonRow>
          )}
        </div>
      ))}

      {accepting && (
        <AcceptDialog
          estimate={accepting}
          onClose={() => setAccepting(null)}
          onDone={(list) => {
            setEstimates(list)
            setAccepting(null)
            onAccepted()
          }}
        />
      )}
    </section>
  )
}

function AcceptDialog({ estimate, onClose, onDone }: { estimate: Estimate; onClose: () => void; onDone: (list: Estimate[]) => void }) {
  const [optionId, setOptionId] = useState(estimate.options[0]?.id ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setSaving(true)
    setError(null)
    try {
      onDone(await estimatesApi.accept(estimate.id, optionId))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save.')
      setSaving(false)
    }
  }

  return (
    <Modal title={`${estimate.numberText} accepted`} onClose={onClose}>
      <p className="text-[13px] text-ink-soft">
        The chosen option's treatments are added as planned, at the quoted prices. They go on the bill when each one starts.
      </p>
      <div className="flex flex-col gap-2">
        {estimate.options.map((o) => (
          <label key={o.id} className="flex cursor-pointer items-start justify-between gap-3 rounded-lg border border-rule px-3 py-2.5">
            <span className="flex items-start gap-2.5">
              <input type="radio" name="option" checked={optionId === o.id} onChange={() => setOptionId(o.id)} className="mt-1 h-4 w-4 accent-accent" />
              <span className="flex flex-col">
                <span className="text-body text-ink">{o.label}</span>
                <span className="text-[12px] text-ink-faint">{o.items.map((i) => i.description).join(', ')}</span>
              </span>
            </span>
            {o.totalPaise !== null && <span className="shrink-0 text-body tabular-nums text-ink">{formatINR(o.totalPaise)}</span>}
          </label>
        ))}
      </div>
      {error && <p className="rounded-lg bg-crit-soft px-3.5 py-2.5 text-body text-crit">{error}</p>}
      <ButtonRow>
        <Button variant="ghost" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={save} disabled={saving || !optionId}>
          {saving ? 'Saving…' : 'Plan these treatments'}
        </Button>
      </ButtonRow>
    </Modal>
  )
}

interface ItemDraft {
  key: number
  serviceId: string
  teeth: string
  sittings: string
  price: string
  quantity: string
}

interface OptionDraft {
  key: number
  label: string
  items: ItemDraft[]
}

let nextKey = 1
const blankItem = (): ItemDraft => ({ key: nextKey++, serviceId: '', teeth: '', sittings: '', price: '', quantity: '1' })

function EstimateForm({
  patientId,
  services,
  doctors,
  suggestions,
  treatments,
  showTeeth,
  onSaved,
  onCancel,
}: {
  patientId: string
  services: Service[]
  doctors: Person[]
  suggestions: Suggestion[]
  treatments: Treatment[]
  showTeeth: boolean
  onSaved: (list: Estimate[]) => void
  onCancel: () => void
}) {
  const { clinic } = useAuth()
  const today = todayInZone(clinic?.timezone)
  const listed = (serviceId: string) => {
    const paise = services.find((s) => s.id === serviceId)?.listedPricePaise
    return paise != null ? paiseToRupeesInput(paise) : ''
  }
  // Start from what the doctor recommended and what is already planned.
  const starting: ItemDraft[] = [
    ...suggestions.map((s) => ({ ...blankItem(), serviceId: s.service.id, teeth: s.teeth.join(', '), price: listed(s.service.id) })),
    ...treatments
      .filter((t) => t.status === 'planned')
      .map((t) => ({ ...blankItem(), serviceId: t.service.id, teeth: t.teeth.join(', '), price: listed(t.service.id) })),
  ]
  const [options, setOptions] = useState<OptionDraft[]>([{ key: nextKey++, label: 'Option A', items: starting.length ? starting : [blankItem()] }])
  const [doctorId, setDoctorId] = useDefaultDoctor(doctors)
  const [validUntil, setValidUntil] = useState('')
  const [notes, setNotes] = useState('')
  const [discountType, setDiscountType] = useState<'' | AdjustmentType>('')
  const [discount, setDiscount] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function setItem(optionKey: number, itemKey: number, change: Partial<ItemDraft>) {
    setOptions((current) =>
      current.map((o) =>
        o.key !== optionKey
          ? o
          : {
              ...o,
              items: o.items.map((i) => {
                if (i.key !== itemKey) return i
                const next = { ...i, ...change }
                if (change.serviceId !== undefined && change.serviceId !== i.serviceId) next.price = listed(change.serviceId)
                return next
              }),
            },
      ),
    )
  }

  function discountStored(): number | null {
    if (!discountType) return 0
    if (discountType === 'amount') return rupeesToPaise(discount)
    return /^\d+(\.\d{1,2})?$/.test(discount.trim()) ? Math.round(Number(discount) * 100) : null
  }

  function optionTotal(o: OptionDraft): number | null {
    let subtotal = 0
    for (const i of o.items) {
      const price = rupeesToPaise(i.price)
      const qty = Number(i.quantity)
      if (price === null || !Number.isInteger(qty) || qty < 1) return null
      subtotal += price * qty
    }
    const value = discountStored()
    if (value === null) return null
    return finalPrice({ pricePaise: subtotal, adjustmentType: null, adjustmentValue: 0, discountType: discountType || null, discountValue: value })
  }

  async function save() {
    setError(null)
    const value = discountStored()
    if (value === null) {
      setError('Check the discount: rupees such as 500, or a percentage such as 10.')
      return
    }
    const built = []
    for (const o of options) {
      const items = []
      for (const i of o.items) {
        const teeth = showTeeth && i.teeth.trim() ? parseTeeth(i.teeth) : []
        const price = rupeesToPaise(i.price)
        if (!i.serviceId || teeth === null || price === null) {
          setError(`Check ${o.label}: every row needs a treatment, a price in rupees, and teeth such as 36, 37.`)
          return
        }
        items.push({ serviceId: i.serviceId, teeth, sittings: i.sittings ? Number(i.sittings) : null, unitPricePaise: price, quantity: Number(i.quantity) || 1 })
      }
      built.push({ label: o.label.trim() || 'Option', items })
    }
    setSaving(true)
    try {
      onSaved(
        await estimatesApi.create(patientId, {
          doctorId, validUntil, notes, discountType: discountType || null, discountValue: value, options: built,
        }),
      )
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save the estimate.')
      setSaving(false)
    }
  }

  const input =
    'w-full rounded-lg border border-rule bg-white px-3 py-2 text-body text-ink outline-none placeholder:text-ink-faint focus:border-accent focus:ring-2 focus:ring-accent-tint'

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-rule bg-paper p-4">
      <span className="text-body font-medium text-ink">New estimate</span>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <DoctorSelect label="Doctor" doctors={doctors} value={doctorId} onChange={setDoctorId} />
        <Field label="Valid until" hint="30 days if left empty" type="date" min={today} value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
      </div>

      {options.map((o, optionIndex) => (
        <div key={o.key} className="flex flex-col gap-2.5 rounded-lg border border-rule bg-white p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <input
              aria-label="Option name"
              value={o.label}
              maxLength={60}
              onChange={(e) => setOptions((current) => current.map((x) => (x.key === o.key ? { ...x, label: e.target.value } : x)))}
              className={`${input} max-w-xs font-medium`}
            />
            <span className="flex items-center gap-3">
              <span className="text-body font-medium tabular-nums text-ink">
                {(() => {
                  const total = optionTotal(o)
                  return total === null ? 'Check the amounts' : formatINR(total)
                })()}
              </span>
              {options.length > 1 && (
                <ButtonRow>
                  <Button variant="ghost" className={small} onClick={() => setOptions((current) => current.filter((x) => x.key !== o.key))}>
                    Remove option
                  </Button>
                </ButtonRow>
              )}
            </span>
          </div>
          <div className="hidden grid-cols-[minmax(0,2.4fr)_minmax(0,1fr)_4.5rem_minmax(0,1fr)_3.5rem_2rem] gap-2 text-[12px] text-ink-faint md:grid">
            <span>Treatment</span>
            <span>{showTeeth ? 'Teeth' : ''}</span>
            <span>Sittings</span>
            <span>Price (₹)</span>
            <span>Qty</span>
            <span />
          </div>
          {o.items.map((i) => (
            <div key={i.key} className="grid grid-cols-2 gap-2 md:grid-cols-[minmax(0,2.4fr)_minmax(0,1fr)_4.5rem_minmax(0,1fr)_3.5rem_2rem]">
              <div className="col-span-2 md:col-span-1">
                <ServiceSelect services={services} value={i.serviceId} onChange={(id) => setItem(o.key, i.key, { serviceId: id })} />
              </div>
              {showTeeth ? (
                <input aria-label="Teeth" value={i.teeth} placeholder="36, 37" onChange={(e) => setItem(o.key, i.key, { teeth: e.target.value })} className={input} />
              ) : (
                <span className="hidden md:block" />
              )}
              <input aria-label="Sittings" inputMode="numeric" value={i.sittings} placeholder="1" onChange={(e) => setItem(o.key, i.key, { sittings: e.target.value.replace(/\D/g, '') })} className={input} />
              <input aria-label="Price (₹)" inputMode="decimal" value={i.price} onChange={(e) => setItem(o.key, i.key, { price: e.target.value })} className={input} />
              <input aria-label="Quantity" inputMode="numeric" value={i.quantity} onChange={(e) => setItem(o.key, i.key, { quantity: e.target.value.replace(/\D/g, '') })} className={input} />
              <button
                type="button"
                aria-label="Remove this row"
                disabled={o.items.length === 1}
                onClick={() => setOptions((current) => current.map((x) => (x.key === o.key ? { ...x, items: x.items.filter((y) => y.key !== i.key) } : x)))}
                className="flex items-center justify-center rounded-full text-ink-faint hover:bg-paper-raised hover:text-ink disabled:opacity-30"
              >
                <X size={15} />
              </button>
            </div>
          ))}
          <ButtonRow>
            <Button
              variant="ghost"
              className={small}
              onClick={() => setOptions((current) => current.map((x) => (x.key === o.key ? { ...x, items: [...x.items, blankItem()] } : x)))}
            >
              + Add row
            </Button>
            {optionIndex === options.length - 1 && options.length < 4 && (
              <Button
                variant="tint"
                className={small}
                onClick={() =>
                  setOptions((current) => [...current, { key: nextKey++, label: `Option ${'ABCD'[current.length]}`, items: [blankItem()] }])
                }
              >
                + Add another option
              </Button>
            )}
          </ButtonRow>
        </div>
      ))}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <span className="text-body font-medium text-ink">Discount</span>
          <div className="grid grid-cols-2 gap-2">
            <select
              aria-label="Discount type"
              value={discountType}
              onChange={(e) => setDiscountType(e.target.value as '' | AdjustmentType)}
              className={input}
            >
              <option value="">None</option>
              <option value="percent">Percent</option>
              <option value="amount">Amount (₹)</option>
            </select>
            <input aria-label="Discount" inputMode="decimal" disabled={!discountType} value={discountType ? discount : ''} onChange={(e) => setDiscount(e.target.value)} className={`${input} disabled:bg-paper-raised`} />
          </div>
        </div>
        <TextareaField label="Notes" hint="Optional, printed" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Crown fitted two weeks after the root canal" />
      </div>

      {error && <p className="rounded-lg bg-crit-soft px-3.5 py-2.5 text-body text-crit">{error}</p>}
      <ButtonRow>
        <Button variant="ghost" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={save} disabled={saving || !doctorId}>
          {saving ? 'Saving…' : 'Give estimate'}
        </Button>
      </ButtonRow>
    </div>
  )
}
