import { api } from './api'
import { formatINR } from './money'
import type { Person } from './todayApi'

// The Activity log (owner only): every change, view, download and sign in.

export interface AuditEntry {
  id: number
  action: string
  actorType: string
  actor: Person | null
  entityType: string | null
  entityId: string | null
  patient: { id: string; code: string; name: string } | null
  changes: Record<string, unknown> | null
  ip: string | null
  device: string | null
  occurredAt: string
}

export interface AuditPage {
  items: AuditEntry[]
  nextBeforeId: number | null
  people: Person[]
}

export interface AuditFilters {
  actorId?: string
  patientId?: string
  entityType?: string
  entityId?: string
  action?: string
  dateFrom?: string
  dateTo?: string
}

export const auditApi = {
  async page(filters: AuditFilters, beforeId?: number | null): Promise<AuditPage> {
    const params = new URLSearchParams()
    const keys: [keyof AuditFilters, string][] = [
      ['actorId', 'actor_id'], ['patientId', 'patient_id'], ['entityType', 'entity_type'], ['entityId', 'entity_id'],
      ['action', 'action'], ['dateFrom', 'date_from'], ['dateTo', 'date_to'],
    ]
    for (const [key, name] of keys) if (filters[key]) params.set(name, filters[key]!)
    if (beforeId) params.set('before_id', String(beforeId))
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    const raw = await api.get<any>(`/audit-log?${params}`)
    return {
      /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
      items: raw.items.map((e: any) => ({
        id: e.id,
        action: e.action,
        actorType: e.actor_type,
        actor: e.actor,
        entityType: e.entity_type,
        entityId: e.entity_id,
        patient: e.patient,
        changes: e.changes,
        ip: e.ip,
        device: e.device,
        occurredAt: e.occurred_at,
      })),
      nextBeforeId: raw.next_before_id,
      people: raw.people,
    }
  },
}

const ACTIONS: Record<string, string> = {
  create: 'Added',
  update: 'Changed',
  view: 'Opened',
  download: 'Downloaded',
  delete: 'Moved to the bin',
  restore: 'Restored',
  cancel: 'Cancelled',
  import: 'Imported',
  send: 'Sent on WhatsApp',
  undo: 'Undid',
  sign_in: 'Signed in',
  sign_in_failed: 'Failed to sign in',
  sign_in_code_sent: 'Was sent a sign in code',
  sign_in_code_failed: 'Entered a wrong sign in code',
  password_reset_code_sent: 'Was sent a password reset code',
  password_reset_code_failed: 'Entered a wrong password reset code',
  password_reset: 'Reset their password',
  password_changed: 'Changed their password',
  sign_out: 'Signed out',
}

const THINGS: Record<string, string> = {
  patient: 'the patient',
  consultation: 'a consultation',
  prescription: 'a prescription',
  treatment: 'a treatment',
  visit: 'a visit',
  file: 'an X-ray, photo or document',
  ledger_entry: 'the bill',
  invoice: 'an invoice',
  estimate: 'an estimate',
  follow_up: 'a follow up',
  arrival: "today's arrival",
  staff: 'a login',
  service: 'a service',
  tooth_finding: 'the tooth chart',
  mouth_check: 'a full mouth check',
  import_batch: 'a patient import',
  message: 'a message',
  share_link: 'a shared link',
  message_template: 'a WhatsApp message wording',
  clinic_settings: 'the clinic settings',
  plan: 'the plan',
  plan_change: 'a plan change',
  plan_payment: 'a plan payment',
}

/** "Changed the bill", "Opened the patient", "Signed in". */
export function describeEntry(e: AuditEntry): string {
  const verb = ACTIONS[e.action] ?? e.action.replace(/_/g, ' ')
  if (!e.entityType || e.action.startsWith('sign_') || e.action.startsWith('password_')) return verb
  return `${verb} ${THINGS[e.entityType] ?? e.entityType.replace(/_/g, ' ')}`
}

export const ACTION_OPTIONS = Object.entries(ACTIONS).map(([value, label]) => ({ value, label }))

function plain(value: unknown, money = false): string {
  if (value === null || value === undefined || value === '') return 'empty'
  if (money && typeof value === 'number') return formatINR(value)
  if (typeof value === 'boolean') return value ? 'yes' : 'no'
  if (Array.isArray(value)) return value.length ? value.map((v) => plain(v, money)).join(', ') : 'none'
  if (typeof value === 'object') return JSON.stringify(value)
  // Coded values such as email_code read as words.
  if (typeof value === 'string' && /^[a-z]+(_[a-z]+)+$/.test(value)) return value.replace(/_/g, ' ')
  return String(value)
}

/** Each change as "city: empty to Noida", or "name: Asha Rao" for a single value. Amounts
 * are kept in paise and shown in rupees. */
export function describeChanges(changes: Record<string, unknown> | null): string[] {
  if (!changes) return []
  return Object.entries(changes).map(([key, value]) => {
    const money = key.endsWith('_paise')
    const label = key.replace(/_paise$/, '').replace(/_/g, ' ')
    if (Array.isArray(value) && value.length === 2 && key !== 'teeth' && key !== 'items') {
      return `${label}: ${plain(value[0], money)} to ${plain(value[1], money)}`
    }
    return `${label}: ${plain(value, money)}`
  })
}

/** "Chrome on Windows" from a browser's user agent; the full text stays in the log. */
export function deviceName(userAgent: string | null): string | null {
  if (!userAgent) return null
  const browsers: [RegExp, string][] = [
    [/Edg\//, 'Edge'],
    [/OPR\//, 'Opera'],
    [/Firefox\//, 'Firefox'],
    [/Chrome\//, 'Chrome'],
    [/Safari\//, 'Safari'],
  ]
  const systems: [RegExp, string][] = [
    [/iPhone/, 'iPhone'],
    [/iPad/, 'iPad'],
    [/Android/, 'Android'],
    [/Windows/, 'Windows'],
    [/Mac OS X/, 'Mac'],
    [/Linux/, 'Linux'],
  ]
  const browser = browsers.find(([pattern]) => pattern.test(userAgent))?.[1]
  const system = systems.find(([pattern]) => pattern.test(userAgent))?.[1]
  if (!browser && !system) return 'Another app'
  return [browser, system].filter(Boolean).join(' on ')
}
