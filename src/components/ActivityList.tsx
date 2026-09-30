import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ApiError } from '../lib/api'
import { auditApi, describeChanges, describeEntry, deviceName, type AuditEntry, type AuditFilters } from '../lib/auditApi'
import { clinicPath } from '../lib/clinic'
import { formatDate, formatTime } from '../lib/date'
import { useAuth } from '../state/AuthContext'
import { Button } from './Button'
import { ButtonRow } from './ButtonRow'

const ACTOR_WORD: Record<string, string> = { platform_support: 'Denti support', patient: 'The patient, from a shared link', system: 'Denti' }

// Entries of the Activity log, newest first, with "Load more" for older ones. Used by the
// Activity log page and by the History on a record. Owner only.

export function ActivityList({ filters, showPatient = true }: { filters: AuditFilters; showPatient?: boolean }) {
  const { clinic, clinicSlug } = useAuth()
  const [items, setItems] = useState<AuditEntry[] | null>(null)
  const [next, setNext] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const key = JSON.stringify(filters)

  const load = useCallback(
    async (beforeId: number | null) => {
      setLoading(true)
      setError(null)
      try {
        const page = await auditApi.page(JSON.parse(key) as AuditFilters, beforeId)
        setItems((current) => (beforeId && current ? [...current, ...page.items] : page.items))
        setNext(page.nextBeforeId)
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Could not load the activity.')
      } finally {
        setLoading(false)
      }
    },
    [key],
  )

  useEffect(() => {
    load(null)
  }, [load])

  if (error) return <p className="rounded-lg bg-crit-soft px-3.5 py-2.5 text-body text-crit">{error}</p>
  if (!items) return <p className="text-ink-soft">Loading…</p>
  if (items.length === 0) return <p className="text-body text-ink-soft">Nothing recorded for this yet.</p>

  return (
    <div className="flex flex-col gap-3">
      <ol className="flex flex-col divide-y divide-rule rounded-xl border border-rule bg-white shadow-sm">
        {items.map((e) => {
          const changes = describeChanges(e.changes)
          return (
            <li key={e.id} className="flex flex-col gap-1 px-4 py-3">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <span className="text-body text-ink">
                  <span className="font-medium">{e.actor?.name ?? ACTOR_WORD[e.actorType] ?? 'Denti'}</span>{' '}
                  · {describeEntry(e)}
                  {showPatient && e.patient && (
                    <>
                      {' · '}
                      <Link to={clinicPath(clinicSlug, `patients/${e.patient.code}`)} className="text-accent-deep hover:underline">
                        {e.patient.name} ({e.patient.code})
                      </Link>
                    </>
                  )}
                </span>
                <span className="shrink-0 text-[12px] tabular-nums text-ink-faint">
                  {formatDate(e.occurredAt, clinic?.timezone)} {formatTime(e.occurredAt, clinic?.timezone)}
                </span>
              </div>
              {changes.length > 0 && (
                <ul className="flex flex-col gap-0.5 text-[13px] text-ink-soft">
                  {changes.map((c, i) => (
                    <li key={i} className="break-words">
                      {c}
                    </li>
                  ))}
                </ul>
              )}
              {(e.ip || e.device) && (
                <span className="truncate text-[11px] text-ink-faint" title={e.device ?? undefined}>
                  {[deviceName(e.device), e.ip].filter(Boolean).join(' · ')}
                </span>
              )}
            </li>
          )
        })}
      </ol>
      {next && (
        <ButtonRow>
          <Button variant="secondary" onClick={() => load(next)} disabled={loading}>
            {loading ? 'Loading…' : 'Load more'}
          </Button>
        </ButtonRow>
      )}
    </div>
  )
}
