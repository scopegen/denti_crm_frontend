import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ActivityList } from '../../components/ActivityList'
import { BackTitle } from '../../components/BackTitle'
import { Button } from '../../components/Button'
import { ButtonRow } from '../../components/ButtonRow'
import { Field } from '../../components/Field'
import { ApiError } from '../../lib/api'
import { ACTION_OPTIONS, auditApi, type AuditFilters } from '../../lib/auditApi'
import { clinicPath } from '../../lib/clinic'
import { patientsApi } from '../../lib/patientsApi'
import type { Person } from '../../lib/todayApi'
import { useAuth } from '../../state/AuthContext'

// The Activity log, for the owner only: who did what, to which patient, when and from which
// device. Nobody can edit or delete it. "?person=<id>" opens it filtered to one person.

const selectClass =
  'w-full rounded-lg border border-rule bg-white px-3.5 py-2.5 text-body text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent-tint'

export function ActivityLog() {
  const { clinicSlug } = useAuth()
  const [params] = useSearchParams()
  const [people, setPeople] = useState<Person[]>([])
  const [actorId, setActorId] = useState(params.get('person') ?? '')
  const [action, setAction] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [patientCode, setPatientCode] = useState('')
  const [filters, setFilters] = useState<AuditFilters>({ actorId: params.get('person') ?? undefined })
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    auditApi.page({}, null).then((p) => setPeople(p.people)).catch(() => setPeople([]))
  }, [])

  async function apply() {
    setError(null)
    let patientId: string | undefined
    if (patientCode.trim()) {
      try {
        patientId = (await patientsApi.get(patientCode.trim())).id
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'We could not find that patient.')
        return
      }
    }
    setFilters({ actorId: actorId || undefined, action: action || undefined, dateFrom: dateFrom || undefined, dateTo: dateTo || undefined, patientId })
  }

  function clear() {
    setActorId('')
    setAction('')
    setDateFrom('')
    setDateTo('')
    setPatientCode('')
    setFilters({})
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-10">
      <div className="flex flex-col gap-1">
        <BackTitle to={clinicPath(clinicSlug, 'settings')} label="Back to settings">
          Activity log
        </BackTitle>
        <p className="text-ink-soft">
          Every change, view, download and sign in at the clinic. Only you, the owner, can see this, and nobody can change it.
        </p>
      </div>

      <div className="flex flex-col gap-4 rounded-xl border border-rule bg-white p-5 shadow-sm">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-body font-medium text-ink">Person</span>
            <select value={actorId} onChange={(e) => setActorId(e.target.value)} className={selectClass}>
              <option value="">Everyone</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-body font-medium text-ink">What</span>
            <select value={action} onChange={(e) => setAction(e.target.value)} className={selectClass}>
              <option value="">Everything</option>
              {ACTION_OPTIONS.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </select>
          </label>
          <Field label="Patient ID" hint="Optional" value={patientCode} onChange={(e) => setPatientCode(e.target.value)} placeholder="SMILE-0042" />
          <Field label="From" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          <Field label="To" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
        {error && <p className="rounded-lg bg-crit-soft px-3.5 py-2.5 text-body text-crit">{error}</p>}
        <ButtonRow>
          <Button variant="ghost" onClick={clear}>
            Clear
          </Button>
          <Button onClick={apply}>Show</Button>
        </ButtonRow>
      </div>

      <ActivityList filters={filters} />
    </div>
  )
}
