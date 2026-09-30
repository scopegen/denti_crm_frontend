import { api } from './api'
import type { Numbering } from './teeth'
import type { Person } from './todayApi'
import type { TreatmentStatus } from './treatmentsApi'

// The tooth chart (Standard and Pro): every call, and the snake_case to camelCase conversion.

export type ToothStatus = 'planned' | 'problem' | 'missing' | 'done'
export const MISSING = 'missing'

export interface Finding {
  id: string
  tooth: number
  problem: string
  consultationId: string | null
  notedBy: Person
  notedAt: string
  resolution: 'treated' | 'cleared' | null
  resolvedAt: string | null
  resolvedBy: Person | null
}

export interface ChartTreatment {
  id: string
  service: { id: string; name: string }
  status: TreatmentStatus
  teeth: number[]
  doctor: Person
  startedOn: string | null
  finishedOn: string | null
  createdAt: string
}

export interface ToothChart {
  numbering: Numbering
  /** Teeth with something recorded; every other tooth is healthy. */
  statuses: Record<number, ToothStatus>
  findings: Finding[]
  treatments: ChartTreatment[]
  lastMouthCheck: { checkedOn: string; checkedBy: Person } | null
  problems: string[]
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function toChart(raw: any): ToothChart {
  const statuses: Record<number, ToothStatus> = {}
  for (const [tooth, status] of Object.entries(raw.statuses)) statuses[Number(tooth)] = status as ToothStatus
  return {
    numbering: raw.numbering,
    statuses,
    findings: raw.findings.map((f: any) => ({
      id: f.id,
      tooth: f.tooth,
      problem: f.problem,
      consultationId: f.consultation_id,
      notedBy: f.noted_by,
      notedAt: f.noted_at,
      resolution: f.resolution,
      resolvedAt: f.resolved_at,
      resolvedBy: f.resolved_by,
    })),
    treatments: raw.treatments.map((t: any) => ({
      id: t.id,
      service: t.service,
      status: t.status,
      teeth: t.teeth,
      doctor: t.doctor,
      startedOn: t.started_on,
      finishedOn: t.finished_on,
      createdAt: t.created_at,
    })),
    lastMouthCheck: raw.last_mouth_check
      ? { checkedOn: raw.last_mouth_check.checked_on, checkedBy: raw.last_mouth_check.checked_by }
      : null,
    problems: raw.problems,
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export const chartApi = {
  async get(patientId: string): Promise<ToothChart> {
    return toChart(await api.get(`/patients/${patientId}/tooth-chart`))
  },
  async mark(patientId: string, tooth: number, problem: string): Promise<ToothChart> {
    return toChart(await api.post(`/patients/${patientId}/findings`, { tooth, problem }))
  },
  async clear(findingId: string): Promise<ToothChart> {
    return toChart(await api.post(`/findings/${findingId}/clear`))
  },
  async mouthCheck(patientId: string): Promise<ToothChart> {
    return toChart(await api.post(`/patients/${patientId}/mouth-checks`))
  },
}

/** The same order of importance the server uses: amber, then red, then grey, then green. */
export function statusFrom(marks: Set<ToothStatus>): ToothStatus | null {
  for (const status of ['planned', 'problem', 'missing', 'done'] as ToothStatus[]) if (marks.has(status)) return status
  return null
}
