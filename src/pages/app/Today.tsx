import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '../../components/Button'
import { ButtonRow } from '../../components/ButtonRow'
import { Modal } from '../../components/Modal'
import { PatientPicker } from '../../components/PatientPicker'
import { Pill } from '../../components/Pill'
import { WhatsAppButton } from '../../components/WhatsAppButton'
import { ApiError } from '../../lib/api'
import { clinicPath } from '../../lib/clinic'
import { formatDate, formatLongDate, formatTime, formatTimeOfDay } from '../../lib/date'
import type { PatientSummary } from '../../lib/patientsApi'
import { todayApi, type Arrival, type FollowUpItem, type Person, type TodayData } from '../../lib/todayApi'
import { useAuth } from '../../state/AuthContext'

// The Today page for walk in clinics. Reception taps Arrived when a patient walks in; the
// row turns to Seen by itself when a doctor saves a consultation or visit for that patient.
// Two states only: waiting and seen. Refreshes itself every 30 seconds.

const REFRESH_MS = 30_000

function minutesSince(iso: string): number {
  return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000))
}

function waitingLabel(minutes: number): string {
  if (minutes < 60) return `Waiting ${minutes}m`
  return `Waiting ${Math.floor(minutes / 60)}h ${minutes % 60}m`
}

export function Today() {
  const { clinic, clinicSlug } = useAuth()
  const tz = clinic?.timezone
  const [data, setData] = useState<TodayData | null>(null)
  const [doctors, setDoctors] = useState<Person[]>([])
  const [doctorFilter, setDoctorFilter] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [, setTick] = useState(0)

  const load = useCallback(() => {
    todayApi
      .today(doctorFilter || undefined)
      .then((d) => {
        setData(d)
        setError(null)
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load today.'))
  }, [doctorFilter])

  useEffect(() => {
    load()
    const timer = window.setInterval(() => {
      load()
      setTick((t) => t + 1)
    }, REFRESH_MS)
    return () => window.clearInterval(timer)
  }, [load])

  useEffect(() => {
    todayApi.doctors().then(setDoctors).catch(() => setDoctors([]))
  }, [])

  async function act(action: () => Promise<unknown>) {
    try {
      await action()
      load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.')
    }
  }

  const waiting = data?.arrived.filter((a) => !a.seenAt).length ?? 0
  const seen = data?.arrived.filter((a) => a.seenAt).length ?? 0

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1>Today</h1>
          <p className="text-ink-soft">
            {data ? `${formatLongDate(data.date)} · ${waiting} waiting · ${seen} seen` : 'Loading…'}
          </p>
        </div>
        <ButtonRow>
          <select
            value={doctorFilter}
            onChange={(e) => setDoctorFilter(e.target.value)}
            aria-label="Show patients for"
            className="rounded-lg border border-rule bg-white px-3.5 py-2.5 text-body text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent-tint"
          >
            <option value="">All doctors</option>
            {doctors.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <Button onClick={() => setAddOpen(true)}>+ Patient arrived</Button>
        </ButtonRow>
      </div>

      {error && <p className="rounded-lg bg-crit-soft px-3.5 py-2.5 text-body text-crit">{error}</p>}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Section title="Arrived" count={data?.arrived.length}>
          {data && data.arrived.length === 0 && <Empty>No one has arrived yet. Use Patient arrived when someone walks in.</Empty>}
          {data?.arrived.map((a) => (
            <ArrivalRow key={a.id} arrival={a} tz={tz} clinicSlug={clinicSlug} onCancel={() => act(() => todayApi.cancelArrival(a.id))} />
          ))}
        </Section>

        <div className="flex flex-col gap-6">
          <Section title="Expected today" count={data?.expected.length}>
            {data && data.expected.length === 0 && <Empty>No visits expected today.</Empty>}
            {data?.expected.map((f) => (
              <FollowUpRow key={f.id} item={f} clinicSlug={clinicSlug}>
                <WhatsAppButton className="!px-3.5 !py-1.5" message={{ patientId: f.patient.id, kind: 'visit_reminder', followUpId: f.id }} />
                <Button variant="secondary" className="!px-3.5 !py-1.5" onClick={() => act(() => todayApi.markArrived(f.patient.id))}>
                  Arrived
                </Button>
              </FollowUpRow>
            ))}
          </Section>

          <Section title="Calls to make" count={data?.calls.length}>
            {data && data.calls.length === 0 && <Empty>No calls due today.</Empty>}
            {data?.calls.map((f) => (
              <FollowUpRow key={f.id} item={f} clinicSlug={clinicSlug} showPhone>
                <WhatsAppButton className="!px-3.5 !py-1.5" message={{ patientId: f.patient.id, kind: 'call_reminder', followUpId: f.id }} />
                <Button variant="secondary" className="!px-3.5 !py-1.5" onClick={() => act(() => todayApi.followUpDone(f.id))}>
                  Done
                </Button>
              </FollowUpRow>
            ))}
          </Section>
        </div>
      </div>

      {addOpen && (
        <AddWalkIn
          doctors={doctors}
          onClose={() => setAddOpen(false)}
          onAdded={() => {
            setAddOpen(false)
            load()
          }}
        />
      )}
    </div>
  )
}

function Section({ title, count, children }: { title: string; count?: number; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-rule bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-subheading font-medium text-ink">{title}</h2>
        {count !== undefined && count > 0 && <Pill variant="accent">{count}</Pill>}
      </div>
      <div className="flex flex-col divide-y divide-rule">{children}</div>
    </section>
  )
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="py-3 text-body text-ink-soft">{children}</p>
}

function ArrivalRow({
  arrival,
  tz,
  clinicSlug,
  onCancel,
}: {
  arrival: Arrival
  tz?: string
  clinicSlug: string
  onCancel: () => void
}) {
  const patientPath = clinicPath(clinicSlug, `patients/${arrival.patient.code}`)
  return (
    <div className="flex flex-wrap items-center gap-3 py-3">
      <span className="w-16 shrink-0 font-mono text-[13px] text-ink-soft">{formatTime(arrival.arrivedAt, tz)}</span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <Link to={patientPath} className="truncate text-body font-medium text-ink hover:text-accent-deep">
          {arrival.patient.name}
        </Link>
        <span className="text-[12px] text-ink-faint">
          {arrival.patient.code}
          {arrival.preferredDoctor ? ` · ${arrival.preferredDoctor.name}` : ' · Any doctor'}
        </span>
        {arrival.patient.medicalConditions.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {arrival.patient.medicalConditions.map((c) => (
              <Pill key={c} variant="crit">
                {c}
              </Pill>
            ))}
          </div>
        )}
      </div>
      <div className="flex items-center justify-end gap-2">
        {arrival.seenAt ? (
          <Pill variant="success">Seen</Pill>
        ) : (
          <>
            <Pill variant="warning">{waitingLabel(minutesSince(arrival.arrivedAt))}</Pill>
            <Button variant="ghost" className="!px-2.5 !py-1.5 text-[13px]" onClick={onCancel}>
              Remove
            </Button>
          </>
        )}
      </div>
    </div>
  )
}

function FollowUpRow({
  item,
  clinicSlug,
  showPhone = false,
  children,
}: {
  item: FollowUpItem
  clinicSlug: string
  showPhone?: boolean
  children: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 py-3">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <Link to={clinicPath(clinicSlug, `patients/${item.patient.code}`)} className="truncate text-body font-medium text-ink hover:text-accent-deep">
          {item.patient.name}
        </Link>
        <span className="text-[12px] text-ink-faint">
          {[showPhone ? item.patient.phone : item.patient.code, item.dueTime ? formatTimeOfDay(item.dueTime) : null, item.reason]
            .filter(Boolean)
            .join(' · ')}
        </span>
        {item.overdue && <span className="text-[12px] font-medium text-crit">Overdue since {formatDate(item.dueOn)}</span>}
      </div>
      <ButtonRow>{children}</ButtonRow>
    </div>
  )
}

function AddWalkIn({ doctors, onClose, onAdded }: { doctors: Person[]; onClose: () => void; onAdded: () => void }) {
  const { clinicSlug } = useAuth()
  const navigate = useNavigate()
  const [patient, setPatient] = useState<PatientSummary | null>(null)
  const [doctorId, setDoctorId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleArrived() {
    if (!patient) return
    setSaving(true)
    setError(null)
    try {
      await todayApi.markArrived(patient.id, doctorId || null)
      onAdded()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not mark the patient as arrived.')
      setSaving(false)
    }
  }

  return (
    <Modal title="Patient arrived" onClose={onClose}>
      {error && <p className="rounded-lg bg-crit-soft px-3.5 py-2.5 text-body text-crit">{error}</p>}

      {patient ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-accent bg-accent-tint px-3.5 py-2.5">
          <span className="flex flex-col">
            <span className="text-body font-medium text-accent-deep">{patient.name}</span>
            <span className="font-mono text-[12px] text-accent-deep">{patient.code}</span>
          </span>
          <Button variant="ghost" className="!px-2.5 !py-1 text-[13px]" onClick={() => setPatient(null)}>
            Change
          </Button>
        </div>
      ) : (
        <PatientPicker onPick={setPatient} />
      )}

      <label className="flex flex-col gap-1.5">
        <span className="text-body font-medium text-ink">Doctor</span>
        <select
          value={doctorId}
          onChange={(e) => setDoctorId(e.target.value)}
          className="w-full rounded-lg border border-rule bg-white px-3.5 py-2.5 text-body text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent-tint"
        >
          <option value="">Any doctor</option>
          {doctors.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </label>

      <ButtonRow>
        <Button
          variant="ghost"
          onClick={() => navigate(clinicPath(clinicSlug, 'patients/new'), { state: { markArrived: true, doctorId: doctorId || null } })}
        >
          New patient
        </Button>
        <Button onClick={handleArrived} disabled={!patient || saving}>
          {saving ? 'Saving…' : 'Mark arrived'}
        </Button>
      </ButtonRow>
    </Modal>
  )
}
