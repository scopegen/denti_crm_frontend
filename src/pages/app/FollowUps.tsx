import { useCallback, useEffect, useState, type SubmitEvent } from 'react'
import { Button } from '../../components/Button'
import { ButtonRow } from '../../components/ButtonRow'
import { Field, SelectField } from '../../components/Field'
import { Pill } from '../../components/Pill'
import { WhatsAppButton } from '../../components/WhatsAppButton'
import { ApiError } from '../../lib/api'
import { formatDate, formatTimeOfDay, todayInZone } from '../../lib/date'
import { todayApi, type FollowUp, type FollowUpKind } from '../../lib/todayApi'
import { useAuth } from '../../state/AuthContext'

// A patient's follow ups: calls to make and visits to expect. A history, not one date that
// gets overwritten: done and cancelled follow ups stay listed (as Ranco's Next Call did).

const KIND_LABEL: Record<FollowUpKind, string> = { call: 'Call the patient', visit: 'Expected visit' }
const KIND_OPTIONS = [KIND_LABEL.visit, KIND_LABEL.call]

export function FollowUps({ patientId }: { patientId: string }) {
  const { clinic } = useAuth()
  const today = todayInZone(clinic?.timezone)
  const [items, setItems] = useState<FollowUp[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [kind, setKind] = useState<FollowUpKind>('visit')
  const [dueOn, setDueOn] = useState(today)
  const [dueTime, setDueTime] = useState('')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => {
    todayApi.followUps(patientId).then(setItems).catch(() => setItems([]))
  }, [patientId])

  useEffect(() => {
    load()
  }, [load])

  async function handleAdd(e: SubmitEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await todayApi.addFollowUp(patientId, { kind, dueOn, dueTime: kind === 'call' ? dueTime || null : null, reason })
      setReason('')
      setDueTime('')
      load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not add the follow up.')
    } finally {
      setSaving(false)
    }
  }

  async function close(id: string, action: 'done' | 'cancel') {
    try {
      await (action === 'done' ? todayApi.followUpDone(id) : todayApi.followUpCancel(id))
      load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update the follow up.')
    }
  }

  return (
    <section className="flex flex-col gap-4">
      <form onSubmit={handleAdd} className="flex flex-col gap-4 rounded-xl border border-rule bg-white p-5 shadow-sm">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <SelectField
            label="Type"
            options={KIND_OPTIONS}
            value={KIND_LABEL[kind]}
            onChange={(e) => setKind(e.target.value === KIND_LABEL.call ? 'call' : 'visit')}
          />
          <Field label="Date" type="date" required min={today} value={dueOn} onChange={(e) => setDueOn(e.target.value)} />
          {kind === 'call' ? (
            <Field label="Time" hint="Optional" type="time" value={dueTime} onChange={(e) => setDueTime(e.target.value)} />
          ) : (
            <div className="hidden sm:block" />
          )}
        </div>
        <Field label="Reason" hint="Optional" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Root canal sitting 2" />
        {error && <p className="rounded-lg bg-crit-soft px-3.5 py-2.5 text-body text-crit">{error}</p>}
        <ButtonRow>
          <Button type="submit" disabled={saving}>
            {saving ? 'Adding…' : 'Add follow up'}
          </Button>
        </ButtonRow>
      </form>

      {items && items.length === 0 && <p className="text-body text-ink-soft">No follow ups yet.</p>}
      <div className="flex flex-col divide-y divide-rule rounded-xl border border-rule bg-white px-5 shadow-sm empty:hidden">
        {items?.map((f) => (
          <div key={f.id} className="flex flex-wrap items-center gap-3 py-3">
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-body font-medium text-ink">
                {KIND_LABEL[f.kind]} · {formatDate(f.dueOn)}
                {f.dueTime ? `, ${formatTimeOfDay(f.dueTime)}` : ''}
              </span>
              {f.reason && <span className="text-[13px] text-ink-soft">{f.reason}</span>}
            </div>
            <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
              {f.status === 'upcoming' && f.overdue && <Pill variant="crit">Overdue</Pill>}
              {f.status === 'upcoming' && !f.overdue && <Pill variant="warning">Upcoming</Pill>}
              {f.status === 'done' && <Pill variant="success">Done</Pill>}
              {f.status === 'cancelled' && <Pill>Cancelled</Pill>}
              {f.status === 'upcoming' && (
                <>
                  <WhatsAppButton
                    className="!px-3 !py-1.5 text-[13px]"
                    message={{ patientId, kind: f.kind === 'visit' ? 'visit_reminder' : 'call_reminder', followUpId: f.id }}
                  />
                  <Button variant="ghost" className="!px-2.5 !py-1.5 text-[13px]" onClick={() => close(f.id, 'cancel')}>
                    Cancel
                  </Button>
                  <Button variant="secondary" className="!px-3.5 !py-1.5" onClick={() => close(f.id, 'done')}>
                    Done
                  </Button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
