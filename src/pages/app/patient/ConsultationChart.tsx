import { useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { Button } from '../../../components/Button'
import { ButtonRow } from '../../../components/ButtonRow'
import { ChartLegend, ToothChart } from '../../../components/ToothChart'
import { chartApi, MISSING, statusFrom, type ToothChart as Chart, type ToothStatus } from '../../../lib/chartApi'
import type { Service } from '../../../lib/settingsApi'
import { chartRows, toothLabel, toothName, type Dentition } from '../../../lib/teeth'
import { ServiceSelect } from './clinicalParts'

// The tooth chart inside the consultation form (Standard and Pro). Tap a tooth to mark what
// the exam found, or to recommend a treatment for it. What is marked here is saved with the
// consultation; the chart shows it on top of the patient's existing chart.

export interface FormFinding {
  tooth: number
  problem: string
}

export interface FormRecommendation {
  serviceId: string
  teeth: number[]
}

export function ConsultationChart({
  patientId,
  consultationId,
  childFirst,
  findings,
  onFindings,
  services,
  recommendations,
  onRecommendations,
}: {
  patientId: string
  /** When editing: this consultation's own findings are the ones in the form. */
  consultationId?: string
  childFirst: boolean
  findings: FormFinding[]
  onFindings: (findings: FormFinding[]) => void
  services: Service[]
  recommendations: FormRecommendation[]
  onRecommendations: (items: FormRecommendation[]) => void
}) {
  const [chart, setChart] = useState<Chart | null>(null)
  const [dentition, setDentition] = useState<Dentition>(childFirst ? 'child' : 'adult')
  const [selected, setSelected] = useState<number | null>(null)
  const [serviceId, setServiceId] = useState('')

  useEffect(() => {
    chartApi.get(patientId).then(setChart).catch(() => setChart(null))
  }, [patientId])

  // The patient's chart, with this form's findings in place of this consultation's saved ones.
  const statuses = useMemo(() => {
    const marks = new Map<number, Set<ToothStatus>>()
    const add = (tooth: number, s: ToothStatus) => marks.set(tooth, (marks.get(tooth) ?? new Set()).add(s))
    for (const f of chart?.findings ?? []) {
      if (f.resolution === null && (!consultationId || f.consultationId !== consultationId)) add(f.tooth, f.problem === MISSING ? 'missing' : 'problem')
    }
    for (const f of findings) add(f.tooth, f.problem === MISSING ? 'missing' : 'problem')
    for (const t of chart?.treatments ?? []) {
      for (const tooth of t.teeth) {
        if (t.status === 'planned' || t.status === 'ongoing') add(tooth, 'planned')
        if (t.status === 'finished') add(tooth, 'done')
      }
    }
    const out: Record<number, ToothStatus> = {}
    for (const [tooth, set] of marks) {
      const s = statusFrom(set)
      if (s) out[tooth] = s
    }
    return out
  }, [chart, findings, consultationId])

  if (!chart) return null
  const { upper, lower } = chartRows(dentition)
  const inView = selected !== null && [...upper, ...lower].includes(selected)
  const here = (tooth: number) => findings.filter((f) => f.tooth === tooth)
  const isMissing = (tooth: number) => here(tooth).some((f) => f.problem === MISSING)

  function toggle(tooth: number, problem: string) {
    const has = findings.some((f) => f.tooth === tooth && f.problem === problem)
    if (has) {
      onFindings(findings.filter((f) => !(f.tooth === tooth && f.problem === problem)))
    } else if (problem === MISSING) {
      // A missing tooth has no other problems.
      onFindings([...findings.filter((f) => f.tooth !== tooth), { tooth, problem }])
    } else {
      onFindings([...findings, { tooth, problem }])
    }
  }

  function recommend(tooth: number) {
    if (!serviceId) return
    const existing = recommendations.find((r) => r.serviceId === serviceId)
    const others = recommendations.filter((r) => r.serviceId !== serviceId)
    const teeth = [...new Set([...(existing?.teeth ?? []), tooth])].sort((a, b) => a - b)
    onRecommendations([...others, { serviceId, teeth }])
    setServiceId('')
  }

  const label = (tooth: number) => toothLabel(tooth, chart.numbering)

  return (
    <div role="group" aria-label="Tooth chart" className="flex flex-col gap-3 rounded-lg border border-rule bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-subheading font-medium text-ink">Tooth chart</span>
        <ButtonRow className="!gap-1.5">
          {(['adult', 'child'] as Dentition[]).map((d) => (
            <button
              key={d}
              type="button"
              aria-pressed={dentition === d}
              onClick={() => {
                setDentition(d)
                setSelected(null)
              }}
              className={`rounded-md border px-3 py-1 text-[13px] font-medium ${
                dentition === d ? 'border-accent bg-accent text-white' : 'border-rule bg-white text-ink-soft'
              }`}
            >
              {d === 'adult' ? 'Adult' : 'Child'}
            </button>
          ))}
        </ButtonRow>
      </div>
      <ChartLegend dentition={dentition} statuses={statuses} />
      <ToothChart
        dentition={dentition}
        numbering={chart.numbering}
        statuses={statuses}
        selected={inView ? selected : null}
        onSelect={(tooth) => setSelected(tooth === selected ? null : tooth)}
      />

      {inView && selected !== null ? (
        <div className="flex flex-col gap-3 rounded-lg bg-paper-raised p-3.5">
          <span className="text-body font-medium text-ink">
            Tooth {label(selected)} <span className="font-normal text-ink-soft">· {toothName(selected)}</span>
          </span>
          <div className="flex flex-wrap gap-1.5">
            {chart.problems.map((problem) => {
              const on = here(selected).some((f) => f.problem === problem)
              return (
                <button
                  key={problem}
                  type="button"
                  aria-pressed={on}
                  disabled={isMissing(selected)}
                  onClick={() => toggle(selected, problem)}
                  className={`rounded-full border px-3 py-1 text-[13px] transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${
                    on ? 'border-crit bg-crit-soft font-medium text-crit' : 'border-rule bg-white text-ink hover:border-crit/50'
                  }`}
                >
                  {problem}
                </button>
              )
            })}
          </div>
          <label className="flex items-center gap-2 text-body text-ink">
            <input type="checkbox" checked={isMissing(selected)} onChange={() => toggle(selected, MISSING)} className="h-4 w-4 accent-accent" />
            Tooth is missing
          </label>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
            <ServiceSelect services={services} value={serviceId} onChange={setServiceId} />
            <ButtonRow>
              <Button variant="secondary" className="!px-3 !py-2 text-[13px]" disabled={!serviceId} onClick={() => recommend(selected)}>
                Recommend for tooth {label(selected)}
              </Button>
            </ButtonRow>
          </div>
        </div>
      ) : (
        <p className="text-[13px] text-ink-faint">Tap a tooth to mark what you found or to recommend a treatment for it.</p>
      )}

      {findings.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[12px] text-ink-faint">Found in this exam:</span>
          {[...findings]
            .sort((a, b) => a.tooth - b.tooth)
            .map((f) => (
              <span key={`${f.tooth}-${f.problem}`} className="flex items-center gap-1 rounded-full bg-crit-soft py-0.5 pl-2.5 pr-1 text-[12px] font-medium text-crit">
                {label(f.tooth)} {f.problem === MISSING ? 'Missing' : f.problem}
                <button
                  type="button"
                  aria-label={`Remove ${f.problem} on tooth ${label(f.tooth)}`}
                  onClick={() => toggle(f.tooth, f.problem)}
                  className="rounded-full p-0.5 hover:bg-white/60"
                >
                  <X size={12} />
                </button>
              </span>
            ))}
        </div>
      )}
    </div>
  )
}
