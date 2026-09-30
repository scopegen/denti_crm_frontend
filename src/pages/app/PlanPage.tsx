import { useEffect, useState, type ReactNode } from 'react'
import { ArrowDown, ArrowUp, Check, HardDrive, Stethoscope, UserRound, Users, X } from 'lucide-react'
import { BackTitle } from '../../components/BackTitle'
import { Button } from '../../components/Button'
import { ButtonRow } from '../../components/ButtonRow'
import { Modal } from '../../components/Modal'
import { Pill } from '../../components/Pill'
import { ApiError, refreshSession } from '../../lib/api'
import { clinicPath } from '../../lib/clinic'
import { formatDate } from '../../lib/date'
import { formatINR } from '../../lib/money'
import {
  formatBytes,
  planApi,
  type Meter,
  type PlanChangePreview,
  type PlanInfo,
  type PlanKey,
  type PlanOption,
} from '../../lib/planApi'
import { useAuth } from '../../state/AuthContext'

// Plan and usage, for the owner and receptionist: the clinic's plan and how it is paid,
// how much of each limit is used, what every plan includes, and moving to another plan.
// Near a limit (80%) the meter turns amber; at the limit only new patients, logins or
// uploads stop, and everything already recorded keeps working. Only the owner changes the
// plan: moving up applies at once, moving down when the paid period ends.

const PLAN_ORDER: PlanKey[] = ['basic', 'standard', 'pro']

export function PlanPage() {
  const { clinicSlug, clinic } = useAuth()
  const [info, setInfo] = useState<PlanInfo | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    planApi
      .get()
      .then(setInfo)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load your plan.'))
  }, [])

  const current = info?.plans.find((p) => p.key === info.plan)

  // The clinic's plan also lives in the sign in, which shows or hides features.
  async function changed(next: PlanInfo) {
    setInfo(next)
    await refreshSession()
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-10">
      <BackTitle to={clinicPath(clinicSlug, 'settings')} label="Back to settings">
        Plan and usage
      </BackTitle>

      {error && <p className="rounded-lg bg-crit-soft px-3.5 py-2.5 text-body text-crit">{error}</p>}
      {!info && !error && <p className="text-ink-soft">Loading…</p>}

      {info && current && (
        <>
          <CurrentPlan info={info} current={current} timeZone={clinic?.timezone} onChanged={changed} />
          <ChangePlan info={info} onChanged={changed} />
          <Usage info={info} />
          <ComparePlans info={info} />
        </>
      )}
    </div>
  )
}

const CYCLE_LABEL = { starter: 'Starter pack', monthly: 'Monthly', yearly: 'Yearly' }
const STATUS_PILL: Record<string, ReactNode> = {
  active: <Pill variant="success">Active</Pill>,
  past_due: <Pill variant="warning">Payment due</Pill>,
  cancelled: <Pill variant="crit">Cancelled</Pill>,
}

function CurrentPlan({
  info,
  current,
  timeZone,
  onChanged,
}: {
  info: PlanInfo
  current: PlanOption
  timeZone?: string
  onChanged: (next: PlanInfo) => void
}) {
  const billing = info.billing
  const packs = billing?.storageAddonPacks ?? 0
  const pending = info.pendingChange
  const [keeping, setKeeping] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function keepPlan() {
    if (!pending) return
    setKeeping(true)
    setError(null)
    try {
      onChanged(await planApi.cancel(pending.id))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not keep your plan. Please try again.')
    } finally {
      setKeeping(false)
    }
  }

  let price: string
  let period: string | null = null
  if (!billing) {
    price = `${formatINR(current.monthlyPaise)} a month`
  } else if (billing.billingCycle === 'starter') {
    price = `${formatINR(current.starterPackPaise)} for the first ${info.starterPackMonths} months`
    period = `Covers ${formatDate(billing.currentPeriodStart, timeZone)} to ${formatDate(billing.currentPeriodEnd, timeZone)}. Then ${formatINR(current.monthlyPaise)} a month, or ${formatINR(current.yearlyPaise)} a year.`
  } else {
    price =
      billing.billingCycle === 'monthly' ? `${formatINR(current.monthlyPaise)} a month` : `${formatINR(current.yearlyPaise)} a year`
    period = `Renews on ${formatDate(billing.currentPeriodEnd, timeZone)}.`
  }

  return (
    <div className="relative overflow-hidden rounded-2xl bg-[linear-gradient(120deg,var(--color-hero-from),var(--color-hero-to))] p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-[12px] font-medium uppercase tracking-wide text-accent-deep/80">Your plan</span>
          <span className="text-[28px] font-bold leading-tight text-accent-deep">{info.planName}</span>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          {billing && <Pill variant="accent">{CYCLE_LABEL[billing.billingCycle]}</Pill>}
          {billing && STATUS_PILL[billing.status]}
        </div>
      </div>
      <div className="mt-3 flex flex-col gap-1 text-body text-ink">
        <span className="font-medium">{price}</span>
        {period && <span className="text-ink-soft">{period}</span>}
        {packs > 0 && (
          <span className="text-ink-soft">
            Extra storage: {packs} {packs === 1 ? 'pack' : 'packs'} of {info.storagePackGb} GB, {formatINR(packs * info.storagePackMonthlyPaise)} a month.
          </span>
        )}
        {!billing && <span className="text-ink-soft">Billing details show here once your subscription starts.</span>}
        <span className="text-[13px] text-ink-faint">Prices are before {info.gstPercent}% GST.</span>
      </div>
      {pending && pending.kind === 'downgrade' && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-white/80 px-4 py-3">
          <span className="text-body text-ink">
            Moving to <span className="font-medium">{pending.toPlanName}</span> on {formatDate(pending.effectiveAt, timeZone)}, when your
            paid period ends. Until then you keep {info.planName}.
          </span>
          {info.canChange && (
            <ButtonRow>
              <Button variant="secondary" onClick={keepPlan} disabled={keeping}>
                {keeping ? 'Saving…' : `Keep ${info.planName}`}
              </Button>
            </ButtonRow>
          )}
        </div>
      )}
      {error && <p className="mt-3 rounded-lg bg-crit-soft px-3.5 py-2.5 text-body text-crit">{error}</p>}
    </div>
  )
}

function ChangePlan({ info, onChanged }: { info: PlanInfo; onChanged: (next: PlanInfo) => void }) {
  const [choosing, setChoosing] = useState<PlanOption | null>(null)
  const others = info.plans.filter((p) => p.key !== info.plan)
  const rank = (key: PlanKey) => PLAN_ORDER.indexOf(key)

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-rule bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-1">
        <h2 className="text-subheading font-medium text-ink">Change plan</h2>
        <p className="text-[13px] text-ink-soft">
          {info.canChange
            ? 'Moving up starts straight away, and you pay only the difference for the rest of this period. Moving down starts when your paid period ends. Nothing you have recorded is ever removed.'
            : 'Only the clinic owner can change the plan.'}
        </p>
      </div>
      <div className="flex flex-col divide-y divide-rule">
        {others.map((p) => {
          const up = rank(p.key) > rank(info.plan)
          const waiting = info.pendingChange?.toPlan === p.key
          return (
            <div key={p.key} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="flex items-center gap-2 text-body font-medium text-ink">
                  {p.name}
                  {waiting && <Pill variant="warning">Scheduled</Pill>}
                </span>
                <span className="text-[13px] text-ink-soft">
                  {formatINR(p.monthlyPaise)} a month or {formatINR(p.yearlyPaise)} a year ·{' '}
                  {p.doctors === null ? 'unlimited doctors' : `up to ${p.doctors} ${p.doctors === 1 ? 'doctor' : 'doctors'}`} ·{' '}
                  {p.patients === null ? 'unlimited patients' : `${p.patients.toLocaleString('en-IN')} patients`}
                </span>
              </div>
              {info.canChange && !waiting && (
                <ButtonRow>
                  <Button variant={up ? 'primary' : 'secondary'} className="inline-flex items-center gap-1.5" onClick={() => setChoosing(p)}>
                    {up ? <ArrowUp size={15} /> : <ArrowDown size={15} />}
                    {up ? `Move up to ${p.name}` : `Move down to ${p.name}`}
                  </Button>
                </ButtonRow>
              )}
            </div>
          )
        })}
      </div>
      {choosing && (
        <ChangeDialog
          info={info}
          target={choosing}
          onClose={() => setChoosing(null)}
          onDone={(next) => {
            setChoosing(null)
            onChanged(next)
          }}
        />
      )}
    </section>
  )
}

const ROLE_WORD = { admin: 'receptionist', doctor: 'doctor' } as const

function ChangeDialog({
  info,
  target,
  onClose,
  onDone,
}: {
  info: PlanInfo
  target: PlanOption
  onClose: () => void
  onDone: (next: PlanInfo) => void
}) {
  const { clinic } = useAuth()
  const tz = clinic?.timezone
  const [preview, setPreview] = useState<PlanChangePreview | null>(null)
  const [keep, setKeep] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    planApi
      .preview(target.key)
      .then((p) => {
        setPreview(p)
        setKeep(p.seats.flatMap((s) => s.suggestedKeep))
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not work out the change.'))
  }, [target.key])

  function toggle(id: string) {
    setKeep((current) => (current.includes(id) ? current.filter((k) => k !== id) : [...current, id]))
  }

  const seatsOk = preview?.seats.every((s) => s.active.filter((a) => keep.includes(a.id)).length === s.limit) ?? false

  async function confirm() {
    setSaving(true)
    setError(null)
    try {
      onDone(await planApi.change(target.key, keep))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not change the plan. Please try again.')
      setSaving(false)
    }
  }

  const up = preview?.kind === 'upgrade'
  const cycleWord = preview?.nextBillingCycle === 'yearly' ? 'a year' : 'a month'
  let action = 'Confirm'
  if (preview && up) action = preview.totalPaise > 0 ? `Pay ${formatINR(preview.totalPaise)} and move up` : `Move up to ${target.name}`
  if (preview && !up) action = `Move down on ${formatDate(preview.effectiveAt, tz)}`

  return (
    <Modal title={`Move to ${target.name}`} wide onClose={onClose}>
      {!preview && !error && <p className="text-ink-soft">Working it out…</p>}
      {preview && up && (
        <div className="flex flex-col gap-3 text-body text-ink">
          <p>{target.name} starts as soon as you confirm.</p>
          {preview.totalPaise > 0 && info.billing && (
            <div className="flex flex-col gap-1.5 rounded-lg bg-paper-raised px-4 py-3">
              <span className="text-[13px] text-ink-soft">For the rest of this period, until {formatDate(info.billing.currentPeriodEnd, tz)}</span>
              <Line label={`Difference from ${info.planName}`} value={formatINR(preview.amountPaise)} />
              <Line label={`GST ${info.gstPercent}%`} value={formatINR(preview.gstPaise)} />
              <Line label="To pay now" value={formatINR(preview.totalPaise)} strong />
            </div>
          )}
          <p className="text-ink-soft">
            Then {formatINR(preview.nextPricePaise)} {cycleWord}, plus GST.
          </p>
          {preview.gained.length > 0 && <FeatureList title="You also get" items={preview.gained} tone="ok" />}
          {preview.paymentMethod === 'test' && preview.totalPaise > 0 && (
            <p className="rounded-lg bg-accent-tint px-3.5 py-2.5 text-[13px] text-accent-deep">
              Test payment: online payment is not connected yet, so no money is taken.
            </p>
          )}
        </div>
      )}
      {preview && !up && (
        <div className="flex flex-col gap-3 text-body text-ink">
          <p>
            {target.name} starts on <span className="font-medium">{formatDate(preview.effectiveAt, tz)}</span>, when your paid period ends.
            Until then you keep {info.planName}, and you can change your mind.
          </p>
          <p className="text-ink-soft">
            Then {formatINR(preview.nextPricePaise)} {cycleWord}, plus GST.
          </p>
          {preview.lost.length > 0 && (
            <FeatureList title="These stop. Everything already recorded in them is kept." items={preview.lost} tone="muted" />
          )}
          {preview.seats.map((s) => {
            const chosen = s.active.filter((a) => keep.includes(a.id)).length
            return (
              <div key={s.role} className="flex flex-col gap-2 rounded-lg border border-rule px-4 py-3">
                <span className="font-medium">
                  {target.name} includes {s.limit} {ROLE_WORD[s.role]} {s.limit === 1 ? 'login' : 'logins'}. Choose who stays ({chosen} of{' '}
                  {s.limit}).
                </span>
                <div className="flex flex-col gap-1.5">
                  {s.active.map((a) => (
                    <label key={a.id} className="flex items-center gap-2">
                      <input type="checkbox" checked={keep.includes(a.id)} onChange={() => toggle(a.id)} className="h-4 w-4 accent-accent" />
                      {a.name}
                    </label>
                  ))}
                </div>
                <span className="text-[13px] text-ink-soft">
                  The others are paused: signed out and unable to sign in. Their work stays on every record, and Staff can switch them back on
                  later.
                </span>
              </div>
            )
          })}
          {preview.patients && (
            <p className="rounded-lg bg-warn-soft px-3.5 py-2.5 text-[13px] text-warn">
              You have {preview.patients.used.toLocaleString('en-IN')} patients and {target.name} includes{' '}
              {preview.patients.limit?.toLocaleString('en-IN')}. Nobody is removed, but new patients cannot be added.
            </p>
          )}
          {preview.storageBytes && (
            <p className="rounded-lg bg-warn-soft px-3.5 py-2.5 text-[13px] text-warn">
              Your files use {formatBytes(preview.storageBytes.used)} and {target.name} includes {formatBytes(preview.storageBytes.limit ?? 0)}.
              Nothing is removed, but new uploads stop.
            </p>
          )}
        </div>
      )}
      {error && <p className="rounded-lg bg-crit-soft px-3.5 py-2.5 text-body text-crit">{error}</p>}
      <ButtonRow>
        <Button variant="ghost" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        {preview && (
          <Button onClick={confirm} disabled={saving || !seatsOk}>
            {saving ? 'Saving…' : action}
          </Button>
        )}
      </ButtonRow>
    </Modal>
  )
}

function Line({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-3 ${strong ? 'border-t border-rule pt-1.5 font-medium text-ink' : 'text-ink-soft'}`}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  )
}

function FeatureList({ title, items, tone }: { title: string; items: string[]; tone: 'ok' | 'muted' }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[13px] text-ink-soft">{title}</span>
      <ul className="flex flex-col gap-1">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2">
            {tone === 'ok' ? <Check size={16} className="mt-0.5 shrink-0 text-ok" /> : <X size={15} className="mt-0.5 shrink-0 text-ink-faint" />}
            {item}
          </li>
        ))}
      </ul>
    </div>
  )
}

function Usage({ info }: { info: PlanInfo }) {
  const { usage } = info
  return (
    <section className="flex flex-col gap-4 rounded-xl border border-rule bg-white p-5 shadow-sm">
      <h2 className="text-subheading font-medium text-ink">What you are using</h2>
      <MeterRow
        icon={Users}
        label="Patients"
        meter={usage.patients}
        format={(n) => n.toLocaleString('en-IN')}
        note="Every patient ever registered counts, imported ones included."
        fullNote="New patients cannot be added until you upgrade. Existing patients keep working."
      />
      <MeterRow
        icon={UserRound}
        label="Receptionist logins"
        meter={usage.receptionists}
        format={String}
        seats
        fullNote="Upgrade to add another receptionist."
      />
      <MeterRow
        icon={Stethoscope}
        label="Doctor logins"
        meter={usage.doctors}
        format={String}
        seats
        note="The owner's login is free and never counted, even when the owner treats patients."
        fullNote="Upgrade to add another doctor."
      />
      <MeterRow
        icon={HardDrive}
        label="Storage for X-rays and photos"
        meter={usage.storageBytes}
        format={formatBytes}
        note="Files in the bin count until they are removed for good after 30 days."
        fullNote={`New uploads stop until you add a ${info.storagePackGb} GB pack or upgrade.`}
      />
    </section>
  )
}

function MeterRow({
  icon: Icon,
  label,
  meter,
  format,
  note,
  fullNote,
  seats = false,
}: {
  icon: typeof Users
  label: string
  meter: Meter
  format: (n: number) => string
  note?: string
  fullNote: string
  /** Logins: using every seat the plan includes is normal, so it is shown calmly. */
  seats?: boolean
}) {
  const share = meter.limit ? Math.min(meter.used / meter.limit, 1) : 0
  const full = meter.limit !== null && meter.used >= meter.limit
  const near = !seats && !full && meter.limit !== null && share >= 0.8
  const barColour = full ? (seats ? 'bg-accent-deep' : 'bg-crit') : near ? 'bg-warn' : 'bg-accent'

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-body font-medium text-ink">
          <Icon size={16} className="text-accent" />
          {label}
        </span>
        <span className="shrink-0 whitespace-nowrap text-body text-ink-soft">
          <span className="font-medium text-ink">{format(meter.used)}</span>
          {meter.limit === null ? ' · Unlimited' : ` of ${format(meter.limit)}`}
        </span>
      </div>
      {meter.limit !== null && (
        <div
          className="h-2 w-full overflow-hidden rounded-full bg-paper-raised"
          role="meter"
          aria-label={label}
          aria-valuemin={0}
          aria-valuemax={meter.limit}
          aria-valuenow={meter.used}
        >
          <div className={`h-full rounded-full ${barColour}`} style={{ width: `${Math.max(share * 100, meter.used > 0 ? 2 : 0)}%` }} />
        </div>
      )}
      {full && seats && <p className="text-[13px] text-ink-soft">All in use. {fullNote}</p>}
      {full && !seats && <p className="text-[13px] text-crit">Limit reached. {fullNote}</p>}
      {near && <p className="text-[13px] text-warn">Nearly full. {fullNote}</p>}
      {!full && !near && note && <p className="text-[13px] text-ink-faint">{note}</p>}
    </div>
  )
}

function limitText(value: number | null): string {
  return value === null ? 'Unlimited' : value.toLocaleString('en-IN')
}

function ComparePlans({ info }: { info: PlanInfo }) {
  const rows: { label: string; cell: (p: PlanOption) => ReactNode }[] = [
    { label: 'Monthly', cell: (p) => formatINR(p.monthlyPaise) },
    { label: 'Yearly', cell: (p) => formatINR(p.yearlyPaise) },
    { label: `Starter pack, first ${info.starterPackMonths} months`, cell: (p) => formatINR(p.starterPackPaise) },
    { label: 'Receptionist logins', cell: (p) => limitText(p.receptionists) },
    { label: 'Doctor logins', cell: (p) => (p.doctors === null ? 'Unlimited' : `Up to ${p.doctors}`) },
    { label: 'Patients', cell: (p) => limitText(p.patients) },
    { label: 'Storage', cell: (p) => `${p.storageGb} GB` },
  ]

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-rule bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-1">
        <h2 className="text-subheading font-medium text-ink">Compare plans</h2>
        <p className="text-[13px] text-ink-soft">
          Every plan includes one owner login for free. Prices are before {info.gstPercent}% GST.
        </p>
      </div>

      <div className="-mx-5 overflow-x-auto px-5">
        <table className="w-full border-separate border-spacing-0 text-[13px] sm:text-body">
          <thead>
            <tr>
              <th className="sm:w-[40%]" />
              {info.plans.map((p) => (
                <th
                  key={p.key}
                  className={`px-1.5 pb-3 pt-2 text-center align-bottom sm:px-3 ${p.key === info.plan ? 'rounded-t-lg bg-accent-tint/60' : ''}`}
                >
                  <div className="flex flex-col items-center gap-1.5">
                    {p.key === info.plan && (
                      <>
                        <span className="hidden sm:inline-flex">
                          <Pill variant="solid">Your plan</Pill>
                        </span>
                        <span className="text-[11px] font-medium leading-tight text-accent-deep sm:hidden">Your plan</span>
                      </>
                    )}
                    <span className="text-subheading font-bold text-accent-deep">{p.name}</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label}>
                <td className="border-t border-rule py-2.5 pr-2 text-ink-soft sm:pr-3">{row.label}</td>
                {info.plans.map((p) => (
                  <td
                    key={p.key}
                    className={`whitespace-nowrap border-t border-rule px-1.5 py-2.5 text-center text-ink sm:px-3 ${highlight(p.key, info.plan)}`}
                  >
                    {row.cell(p)}
                  </td>
                ))}
              </tr>
            ))}
            {info.features.map((feature, i) => (
              <tr key={feature.label}>
                <td className="border-t border-rule py-2.5 pr-2 text-ink-soft sm:pr-3">{feature.label}</td>
                {info.plans.map((p) => (
                  <td
                    key={p.key}
                    className={`border-t border-rule px-1.5 py-2.5 text-center sm:px-3 ${highlight(p.key, info.plan)} ${
                      i === info.features.length - 1 && p.key === info.plan ? 'rounded-b-lg' : ''
                    }`}
                  >
                    {feature.plans.includes(p.key) ? (
                      <Check size={17} className="mx-auto text-ok" aria-label="Included" />
                    ) : (
                      <X size={15} className="mx-auto text-ink-faint/60" aria-label="Not included" />
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="rounded-lg bg-paper-raised px-4 py-3 text-[13px] text-ink-soft">
        Need more room for X-rays and photos? Add {info.storagePackGb} GB for {formatINR(info.storagePackMonthlyPaise)} a month on any plan.
        Adding storage opens here with online payments.
      </p>
    </section>
  )
}

function highlight(key: PlanKey, current: PlanKey): string {
  return key === current ? 'bg-accent-tint/60' : ''
}
