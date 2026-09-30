import { useCallback, useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { Button } from '../../../components/Button'
import { ButtonRow } from '../../../components/ButtonRow'
import { Pill } from '../../../components/Pill'
import { ChartLegend, STATUS_WORDS, ToothChart } from '../../../components/ToothChart'
import { calculateAge } from '../../../lib/age'
import { ApiError } from '../../../lib/api'
import { chartApi, MISSING, type ToothChart as Chart, type ToothStatus } from '../../../lib/chartApi'
import { formatDate } from '../../../lib/date'
import { settingsApi, type Service } from '../../../lib/settingsApi'
import { chartRows, toothLabel, toothName, type Dentition, type Numbering } from '../../../lib/teeth'
import { todayApi, type Person } from '../../../lib/todayApi'
import { STATUS_LABEL, treatmentsApi } from '../../../lib/treatmentsApi'
import { useAuth } from '../../../state/AuthContext'
import type { PatientContext } from '../PatientDetail'
import { ServiceSelect, useDefaultDoctor } from './clinicalParts'

// The Tooth chart sheet on a patient's page (Standard and Pro). Tap a tooth to mark a
// problem or the tooth missing, see its treatments and history, or plan a treatment for it.
// The colours are worked out by the server from those records.

const PILL: Record<ToothStatus | 'healthy', 'crit' | 'warning' | 'success' | 'outline'> = {
  problem: 'crit',
  planned: 'warning',
  done: 'success',
  missing: 'outline',
  healthy: 'outline',
}

function Segmented<T extends string>({ label, options, value, onChange }: { label: string; options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-lg border border-rule bg-white p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors ${
            value === o.value ? 'bg-accent text-white' : 'text-ink-soft hover:text-ink'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function ToothChartSection() {
  const { patient } = useOutletContext<PatientContext>()
  const age = calculateAge(patient.dob, patient.birthYear)
  const [chart, setChart] = useState<Chart | null>(null)
  const [dentition, setDentition] = useState<Dentition>(age !== null && age < 12 ? 'child' : 'adult')
  const [numbering, setNumbering] = useState<Numbering | null>(null)
  const [selected, setSelected] = useState<number | null>(null)
  const [services, setServices] = useState<Service[]>([])
  const [doctors, setDoctors] = useState<Person[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    chartApi
      .get(patient.id)
      .then(setChart)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load the tooth chart.'))
  }, [patient.id])

  useEffect(() => {
    load()
    settingsApi.services().then(setServices).catch(() => setServices([]))
    todayApi.doctors().then(setDoctors).catch(() => setDoctors([]))
  }, [load])

  async function change(action: () => Promise<Chart>) {
    setBusy(true)
    setError(null)
    try {
      setChart(await action())
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save the change.')
    } finally {
      setBusy(false)
    }
  }

  if (!chart) return error ? <p className="rounded-lg bg-crit-soft px-3.5 py-2.5 text-body text-crit">{error}</p> : <p className="text-ink-soft">Loading…</p>
  const shownNumbering = numbering ?? chart.numbering
  const { upper, lower } = chartRows(dentition)
  const inView = new Set([...upper, ...lower])
  const openProblems = (tooth: number) => chart.findings.filter((f) => f.tooth === tooth && f.resolution === null)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] text-ink-soft">
          {chart.lastMouthCheck
            ? `Last full mouth check: ${formatDate(chart.lastMouthCheck.checkedOn)} by ${chart.lastMouthCheck.checkedBy.name}`
            : 'No full mouth check recorded yet.'}
        </p>
        <ButtonRow className="!gap-2">
          <Segmented
            label="Teeth"
            value={dentition}
            onChange={(d) => {
              setDentition(d)
              setSelected(null)
            }}
            options={[
              { value: 'adult', label: 'Adult' },
              { value: 'child', label: 'Child' },
            ]}
          />
          <Segmented
            label="Numbering"
            value={shownNumbering}
            onChange={setNumbering}
            options={[
              { value: 'fdi', label: 'FDI' },
              { value: 'universal', label: 'Universal' },
            ]}
          />
          <Button variant="secondary" className="!px-3 !py-1.5 text-[13px]" disabled={busy} onClick={() => change(() => chartApi.mouthCheck(patient.id))}>
            Full mouth check done
          </Button>
        </ButtonRow>
      </div>

      {error && <p className="rounded-lg bg-crit-soft px-3.5 py-2.5 text-body text-crit">{error}</p>}

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex flex-col gap-4 rounded-xl border border-rule bg-white p-4 shadow-sm">
          <ChartLegend dentition={dentition} statuses={chart.statuses} />
          <ToothChart
            dentition={dentition}
            numbering={shownNumbering}
            statuses={chart.statuses}
            selected={selected !== null && inView.has(selected) ? selected : null}
            onSelect={setSelected}
            describe={(tooth) => openProblems(tooth).filter((f) => f.problem !== MISSING).map((f) => f.problem).join(', ')}
          />
          <p className="text-[13px] text-ink-faint">
            Tap a tooth to mark a problem or plan its treatment. Finishing a treatment turns the tooth green.
          </p>
        </div>

        {selected !== null && inView.has(selected) ? (
          <ToothPanel
            key={selected}
            tooth={selected}
            numbering={shownNumbering}
            chart={chart}
            patientId={patient.id}
            services={services}
            doctors={doctors}
            busy={busy}
            onChange={change}
            onTreatmentAdded={load}
          />
        ) : (
          <div className="rounded-xl border border-dashed border-rule bg-white/60 p-5 text-body text-ink-soft">
            Tap any tooth to see its history, mark a problem, or plan a treatment for it.
          </div>
        )}
      </div>
    </div>
  )
}

function ToothPanel({
  tooth,
  numbering,
  chart,
  patientId,
  services,
  doctors,
  busy,
  onChange,
  onTreatmentAdded,
}: {
  tooth: number
  numbering: Numbering
  chart: Chart
  patientId: string
  services: Service[]
  doctors: Person[]
  busy: boolean
  onChange: (action: () => Promise<Chart>) => void
  onTreatmentAdded: () => void
}) {
  const timeZone = useAuth().clinic?.timezone
  const status: ToothStatus | 'healthy' = chart.statuses[tooth] ?? 'healthy'
  const open = chart.findings.filter((f) => f.tooth === tooth && f.resolution === null)
  const missing = open.find((f) => f.problem === MISSING)
  const treatments = chart.treatments.filter((t) => t.teeth.includes(tooth))
  const [serviceId, setServiceId] = useState('')
  const [doctorId] = useDefaultDoctor(doctors)
  const [planning, setPlanning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function plan() {
    setPlanning(true)
    setError(null)
    try {
      await treatmentsApi.create(patientId, {
        serviceId, doctorId, teeth: [tooth], consultationId: null, notes: '', start: false, pricePaise: null,
      })
      setServiceId('')
      onTreatmentAdded()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not plan the treatment.')
    } finally {
      setPlanning(false)
    }
  }

  // Moments (a problem noted) and plain days (a treatment started) mixed, newest first.
  type Event = { order: string; day: string; text: string }
  const history: Event[] = []
  const moment = (at: string) => ({ order: at, day: formatDate(at, timeZone) })
  const onDay = (day: string, late = false) => ({ order: `${day}T${late ? '23:59' : '12:00'}`, day: formatDate(day) })
  for (const f of chart.findings.filter((x) => x.tooth === tooth)) {
    const what = f.problem === MISSING ? 'Marked missing' : `${f.problem} found`
    history.push({ ...moment(f.notedAt), text: `${what} by ${f.notedBy.name}` })
    if (f.resolvedAt) {
      const how = f.resolution === 'treated' ? 'treated' : f.problem === MISSING ? 'marked present' : 'cleared'
      history.push({ ...moment(f.resolvedAt), text: `${f.problem === MISSING ? 'Tooth' : f.problem} ${how}${f.resolvedBy ? ` by ${f.resolvedBy.name}` : ''}` })
    }
  }
  for (const t of treatments) {
    history.push({ ...moment(t.createdAt), text: `${t.service.name} added, ${t.doctor.name}` })
    if (t.startedOn) history.push({ ...onDay(t.startedOn), text: `${t.service.name} started` })
    if (t.finishedOn) history.push({ ...onDay(t.finishedOn, true), text: `${t.service.name} finished` })
  }
  history.sort((a, b) => (a.order < b.order ? 1 : -1))

  return (
    <aside className="flex flex-col gap-5 rounded-xl border border-rule bg-white p-5 shadow-sm" aria-live="polite">
      <div className="flex items-center gap-3.5">
        <span className="grid h-14 min-w-14 place-items-center rounded-xl bg-accent-tint px-2 text-[24px] font-bold text-accent-deep">
          {toothLabel(tooth, numbering)}
        </span>
        <div className="flex flex-col gap-1">
          <span className="text-body font-medium text-ink">{toothName(tooth)}</span>
          <span>
            <Pill variant={PILL[status]}>{STATUS_WORDS[status]}</Pill>
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        <span className="text-[12px] font-medium uppercase tracking-wide text-ink-faint">Problem found</span>
        <div className="flex flex-wrap gap-1.5">
          {chart.problems.map((problem) => {
            const finding = open.find((f) => f.problem === problem)
            return (
              <button
                key={problem}
                type="button"
                aria-pressed={Boolean(finding)}
                disabled={busy || Boolean(missing)}
                onClick={() => onChange(() => (finding ? chartApi.clear(finding.id) : chartApi.mark(patientId, tooth, problem)))}
                className={`rounded-full border px-3 py-1 text-[13px] transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${
                  finding ? 'border-crit bg-crit-soft font-medium text-crit' : 'border-rule bg-paper text-ink hover:border-crit/50'
                }`}
              >
                {problem}
              </button>
            )
          })}
        </div>
        <label className="flex items-center gap-2 text-body text-ink">
          <input
            type="checkbox"
            checked={Boolean(missing)}
            disabled={busy}
            onChange={() => onChange(() => (missing ? chartApi.clear(missing.id) : chartApi.mark(patientId, tooth, MISSING)))}
            className="h-4 w-4 accent-accent"
          />
          Tooth is missing
        </label>
      </div>

      <div className="flex flex-col gap-2.5">
        <span className="text-[12px] font-medium uppercase tracking-wide text-ink-faint">Treatment</span>
        {treatments.map((t) => (
          <div key={t.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-rule px-3 py-2">
            <span className="text-body text-ink">{t.service.name}</span>
            <Pill variant={t.status === 'finished' ? 'success' : 'warning'}>{STATUS_LABEL[t.status]}</Pill>
          </div>
        ))}
        <ServiceSelect
          services={services}
          value={serviceId}
          onChange={setServiceId}
          label={treatments.length ? 'Plan another' : 'Plan a treatment'}
          required={false}
        />
        {error && <p className="text-[13px] text-crit">{error}</p>}
        <ButtonRow>
          <Button variant="secondary" className="!px-3 !py-1.5 text-[13px]" disabled={!serviceId || !doctorId || planning} onClick={plan}>
            {planning ? 'Planning…' : 'Plan for this tooth'}
          </Button>
        </ButtonRow>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-[12px] font-medium uppercase tracking-wide text-ink-faint">History</span>
        {history.length === 0 ? (
          <p className="text-[13px] text-ink-faint">Nothing recorded for this tooth yet.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {history.map((e, i) => (
              <li key={i} className="text-[13px] text-ink-soft">
                <span className="text-ink-faint">{e.day}</span> · {e.text}
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  )
}
