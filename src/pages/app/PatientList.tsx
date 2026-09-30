import { useEffect, useState, type ComponentType } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Search, UserPlus, Users } from 'lucide-react'
import { Button } from '../../components/Button'
import { ButtonRow } from '../../components/ButtonRow'
import { calculateAge } from '../../lib/age'
import { ApiError } from '../../lib/api'
import { clinicPath } from '../../lib/clinic'
import { patientsApi, type PatientPage, type PatientStats } from '../../lib/patientsApi'
import { useAuth } from '../../state/AuthContext'

// Laid out like Ranco's patient list: title and New patient on top, stat tiles, search, table.
// Search and paging happen on the server, so a clinic with thousands of patients stays fast.

const PAGE_SIZE = 25

export function PatientList() {
  const { clinicSlug } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const justAdded = (location.state as { justAdded?: string } | null)?.justAdded

  const [query, setQuery] = useState('')
  const [searchFor, setSearchFor] = useState('')
  const [page, setPage] = useState(1)
  const [result, setResult] = useState<PatientPage | null>(null)
  const [stats, setStats] = useState<PatientStats | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Search a moment after typing stops, not on every key press.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearchFor(query)
      setPage(1)
    }, 300)
    return () => window.clearTimeout(timer)
  }, [query])

  useEffect(() => {
    let cancelled = false
    patientsApi
      .list(searchFor, page, PAGE_SIZE)
      .then((data) => {
        if (!cancelled) setResult(data)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Could not load patients.')
      })
    return () => {
      cancelled = true
    }
  }, [searchFor, page])

  useEffect(() => {
    patientsApi.stats().then(setStats).catch(() => setStats(null))
  }, [])

  const nearLimit = stats?.limit != null && stats.used >= stats.limit * 0.8
  const first = result && result.total > 0 ? (result.page - 1) * result.pageSize + 1 : 0
  const last = result ? Math.min(result.page * result.pageSize, result.total) : 0

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10">
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1>Patients</h1>
          <p className="text-ink-soft">
            {!result ? 'Loading…' : searchFor ? `${result.total} found` : `${result.total} registered`}
          </p>
        </div>
        <ButtonRow>
          <Link to={clinicPath(clinicSlug, 'patients/new')}>
            <Button>+ New patient</Button>
          </Link>
        </ButtonRow>
      </div>

      {stats && (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <StatTile tone="sky" icon={Users} value={stats.total} label="Total Patients" />
          <StatTile tone="mint" icon={UserPlus} value={stats.newThisMonth} label="New This Month" />
        </div>
      )}

      {nearLimit && stats && (
        <p className="rounded-lg bg-warn-soft px-4 py-3 text-body text-warn">
          {stats.used >= (stats.limit ?? 0)
            ? `Your plan's limit of ${stats.limit?.toLocaleString('en-IN')} patients is reached. Upgrade your plan to register more.`
            : `${stats.used.toLocaleString('en-IN')} of the ${stats.limit?.toLocaleString('en-IN')} patients your plan includes are registered.`}
        </p>
      )}

      {justAdded && (
        <div className="rounded-lg border border-rule bg-accent-tint px-4 py-3 text-body text-accent-deep">
          <span className="font-medium">{justAdded}</span> added to the system.
        </div>
      )}

      {error && <p className="rounded-lg bg-crit-soft px-3.5 py-2.5 text-body text-crit">{error}</p>}

      <div className="relative">
        <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, phone, or patient ID"
          aria-label="Search patients"
          className="w-full min-w-0 rounded-lg border border-rule bg-white py-2.5 pl-10 pr-3.5 text-body text-ink placeholder:text-ink-faint outline-none transition-colors duration-150 focus:border-accent focus:ring-2 focus:ring-accent-tint"
        />
      </div>

      <div className="overflow-x-auto rounded-xl border border-rule bg-white shadow-sm">
        <table className="w-full text-left sm:min-w-[560px]">
          <thead>
            <tr className="border-b border-rule">
              <th className="whitespace-nowrap px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-ink-soft">Patient ID</th>
              <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-ink-soft">Name</th>
              <th className="hidden px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-ink-soft sm:table-cell">Phone</th>
              <th className="hidden px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-ink-soft sm:table-cell">Age</th>
              <th className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-wider text-ink-soft">Actions</th>
            </tr>
          </thead>
          <tbody>
            {result?.items.map((patient) => {
              const age = calculateAge(patient.dob, patient.birthYear)
              const path = clinicPath(clinicSlug, `patients/${patient.code}`)
              return (
                <tr
                  key={patient.id}
                  onClick={() => navigate(path)}
                  className="cursor-pointer border-b border-rule transition-colors last:border-none hover:bg-accent-tint/40"
                >
                  <td className="px-4 py-3 font-mono text-[13px] text-ink-soft">
                    <span className="hidden sm:inline">{patient.code}</span>
                    <span className="sm:hidden">{String(patient.patientNumber).padStart(4, '0')}</span>
                  </td>
                  <td className="px-4 py-3">
                    <Link to={path} onClick={(e) => e.stopPropagation()} className="font-medium text-ink hover:text-accent-deep">
                      {patient.name}
                    </Link>
                  </td>
                  <td className="hidden px-4 py-3 text-ink-soft sm:table-cell">{patient.phone}</td>
                  <td className="hidden px-4 py-3 text-ink-soft sm:table-cell">{age === null ? 'Not added' : `${age} yrs`}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end">
                      <Link
                        to={path}
                        onClick={(e) => e.stopPropagation()}
                        aria-label={`View ${patient.name}`}
                        className="flex w-16 items-center justify-center rounded-md border border-transparent bg-sky-soft px-2.5 py-1 text-[12px] font-medium text-sky transition-colors hover:bg-sky hover:text-white"
                      >
                        View
                      </Link>
                    </div>
                  </td>
                </tr>
              )
            })}
            {result && result.items.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-ink-soft">
                  {searchFor ? 'No patients match this search.' : 'No patients yet. Register the first one with New patient.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {result && result.total > result.pageSize && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[13px] text-ink-soft">
            Showing {first} to {last} of {result.total}
          </p>
          <ButtonRow>
            <Button variant="ghost" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <Button variant="secondary" disabled={last >= result.total} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </ButtonRow>
        </div>
      )}
    </div>
  )
}

const TONES = {
  sky: { tile: 'bg-sky-soft', text: 'text-sky' },
  mint: { tile: 'bg-mint-soft', text: 'text-mint' },
  lavender: { tile: 'bg-lavender-soft', text: 'text-lavender' },
  teal: { tile: 'bg-teal-soft', text: 'text-teal' },
}

function StatTile({
  tone,
  icon: Icon,
  value,
  label,
}: {
  tone: keyof typeof TONES
  icon: ComponentType<{ size?: number }>
  value: number
  label: string
}) {
  const { tile, text } = TONES[tone]
  return (
    <div className={`flex items-center gap-3 rounded-xl p-3 shadow-sm sm:p-4 ${tile}`}>
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/70 ${text}`}>
        <Icon size={18} />
      </span>
      <div>
        <p className={`text-heading font-bold ${text}`}>{value.toLocaleString('en-IN')}</p>
        <p className="text-[13px] font-medium text-ink-soft">{label}</p>
      </div>
    </div>
  )
}
