import { useCallback, useEffect, useState } from 'react'
import { Download, Eye } from 'lucide-react'
import { Button } from '../../../components/Button'
import { ButtonRow } from '../../../components/ButtonRow'
import { Field } from '../../../components/Field'
import { Modal } from '../../../components/Modal'
import { Pill } from '../../../components/Pill'
import { WhatsAppButton } from '../../../components/WhatsAppButton'
import { ApiError } from '../../../lib/api'
import { billingApi, type Invoice, type InvoiceableItem, type Invoices } from '../../../lib/billingApi'
import { formatDate } from '../../../lib/date'
import { saveFile, viewFile } from '../../../lib/files'
import { formatINR } from '../../../lib/money'

// Invoices inside the Bill sheet: a printable document for consultation fees and treatments
// already on the bill, numbered per financial year. Cancelling keeps the number and frees
// the items for a new invoice; the bill itself never changes.

const small = '!px-2.5 !py-1 text-[13px]'

export function InvoicesPanel({ patientId }: { patientId: string }) {
  const [data, setData] = useState<Invoices | null>(null)
  const [creating, setCreating] = useState(false)
  const [cancelling, setCancelling] = useState<Invoice | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    billingApi
      .invoices(patientId)
      .then(setData)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load the invoices.'))
  }, [patientId])

  useEffect(() => {
    load()
  }, [load])

  async function open(invoice: Invoice, download: boolean) {
    setError(null)
    try {
      if (download) await saveFile(() => billingApi.invoicePdf(invoice.id, true), 'Invoice.pdf')
      else await viewFile(() => billingApi.invoicePdf(invoice.id))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not open the invoice.')
    }
  }

  if (!data) return null

  return (
    <section aria-label="Invoices" className="flex flex-col gap-3 rounded-xl border border-rule bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col">
          <span className="text-subheading font-medium text-ink">Invoices</span>
          <span className="text-[13px] text-ink-soft">
            {data.invoiceable.length > 0
              ? `${data.invoiceable.length} ${data.invoiceable.length === 1 ? 'item' : 'items'} not on an invoice yet`
              : 'Everything on the bill is on an invoice.'}
          </span>
        </div>
        <ButtonRow>
          <Button variant="secondary" onClick={() => setCreating(true)} disabled={data.invoiceable.length === 0}>
            + New invoice
          </Button>
        </ButtonRow>
      </div>

      {error && <p className="rounded-lg bg-crit-soft px-3.5 py-2.5 text-body text-crit">{error}</p>}

      {data.invoices.length > 0 && (
        <div className="flex flex-col divide-y divide-rule rounded-lg border border-rule">
          {data.invoices.map((invoice) => (
            <div key={invoice.id} className="flex flex-wrap items-center justify-between gap-3 px-3.5 py-2.5">
              <div className="flex min-w-0 flex-col">
                <span className="flex flex-wrap items-center gap-2 text-body text-ink">
                  <span className={`font-mono text-[13px] ${invoice.status === 'cancelled' ? 'line-through opacity-60' : ''}`}>
                    {invoice.numberText}
                  </span>
                  {invoice.status === 'cancelled' && <Pill variant="crit">Cancelled</Pill>}
                </span>
                <span className="text-[12px] text-ink-faint">
                  {formatDate(invoice.issuedOn)} · {formatINR(invoice.totalPaise)} · {invoice.lines.length}{' '}
                  {invoice.lines.length === 1 ? 'item' : 'items'}
                  {invoice.cancelReason ? ` · ${invoice.cancelReason}` : ''}
                </span>
              </div>
              <ButtonRow className="!gap-1.5">
                {invoice.status === 'issued' && (
                  <Button variant="ghost" className={small} onClick={() => setCancelling(invoice)}>
                    Cancel
                  </Button>
                )}
                <Button variant="ghost" className={`flex items-center gap-1.5 ${small}`} onClick={() => open(invoice, true)}>
                  <Download size={14} /> Download
                </Button>
                {invoice.status === 'issued' && (
                  <WhatsAppButton className={small} message={{ patientId, kind: 'invoice', invoiceId: invoice.id }} />
                )}
                <Button variant="tint" className={`flex items-center gap-1.5 ${small}`} onClick={() => open(invoice, false)}>
                  <Eye size={14} /> View PDF
                </Button>
              </ButtonRow>
            </div>
          ))}
        </div>
      )}

      {creating && (
        <NewInvoiceDialog
          patientId={patientId}
          items={data.invoiceable}
          onDone={(updated) => {
            setData(updated)
            setCreating(false)
          }}
          onClose={() => setCreating(false)}
        />
      )}
      {cancelling && (
        <CancelInvoiceDialog
          invoice={cancelling}
          onDone={(updated) => {
            setData(updated)
            setCancelling(null)
          }}
          onClose={() => setCancelling(null)}
        />
      )}
    </section>
  )
}

function NewInvoiceDialog({
  patientId,
  items,
  onDone,
  onClose,
}: {
  patientId: string
  items: InvoiceableItem[]
  onDone: (data: Invoices) => void
  onClose: () => void
}) {
  const [chosen, setChosen] = useState<Set<string>>(new Set(items.map((i) => i.id)))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const picked = items.filter((i) => chosen.has(i.id))
  const total = picked.reduce((sum, i) => sum + i.amountPaise, 0)

  function toggle(id: string) {
    setChosen((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function save() {
    setSaving(true)
    setError(null)
    try {
      onDone(await billingApi.createInvoice(patientId, picked))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create the invoice.')
      setSaving(false)
    }
  }

  return (
    <Modal title="New invoice" onClose={onClose}>
      <p className="text-[13px] text-ink-soft">Tick what goes on this invoice. Amounts are as on the bill, after any discount.</p>
      <div className="flex flex-col divide-y divide-rule rounded-lg border border-rule">
        {items.map((item) => (
          <label key={item.id} className="flex cursor-pointer items-center justify-between gap-3 px-3 py-2.5">
            <span className="flex min-w-0 items-center gap-2.5">
              <input type="checkbox" checked={chosen.has(item.id)} onChange={() => toggle(item.id)} className="h-4 w-4 accent-accent" />
              <span className="flex min-w-0 flex-col">
                <span className="text-body text-ink">
                  {item.description}
                  {item.teeth.length > 0 ? ` · ${item.teeth.join(', ')}` : ''}
                </span>
                <span className="text-[12px] text-ink-faint">{formatDate(item.on)}</span>
              </span>
            </span>
            <span className="shrink-0 text-body tabular-nums text-ink">{formatINR(item.amountPaise)}</span>
          </label>
        ))}
      </div>
      <p className="text-right text-body font-medium text-ink">Total {formatINR(total)}</p>
      {error && <p className="rounded-lg bg-crit-soft px-3.5 py-2.5 text-body text-crit">{error}</p>}
      <ButtonRow>
        <Button variant="ghost" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={save} disabled={saving || picked.length === 0}>
          {saving ? 'Creating…' : 'Create invoice'}
        </Button>
      </ButtonRow>
    </Modal>
  )
}

function CancelInvoiceDialog({ invoice, onDone, onClose }: { invoice: Invoice; onDone: (data: Invoices) => void; onClose: () => void }) {
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setSaving(true)
    setError(null)
    try {
      onDone(await billingApi.cancelInvoice(invoice.id, reason))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not cancel the invoice.')
      setSaving(false)
    }
  }

  return (
    <Modal title={`Cancel invoice ${invoice.numberText}?`} onClose={onClose}>
      <p className="text-body text-ink-soft">
        It keeps its number and prints marked cancelled. Its items can go on a new invoice. The bill does not change.
      </p>
      <Field label="Why" required value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} placeholder="Wrong items" />
      {error && <p className="rounded-lg bg-crit-soft px-3.5 py-2.5 text-body text-crit">{error}</p>}
      <ButtonRow>
        <Button variant="ghost" onClick={onClose} disabled={saving}>
          Keep invoice
        </Button>
        <Button variant="danger" onClick={save} disabled={saving || !reason.trim()}>
          {saving ? 'Cancelling…' : 'Cancel invoice'}
        </Button>
      </ButtonRow>
    </Modal>
  )
}
