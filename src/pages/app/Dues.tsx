import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'
import { Button } from '../../components/Button'
import { ButtonRow } from '../../components/ButtonRow'
import { ApiError } from '../../lib/api'
import { billingApi, type Dues as DuesPage } from '../../lib/billingApi'
import { clinicPath } from '../../lib/clinic'
import { formatDate } from '../../lib/date'
import { formatINR } from '../../lib/money'
import { useAuth } from '../../state/AuthContext'

// Dues, for the owner and receptionist: every patient who owes the clinic money, most owed
// first, laid out like the patient list. Opening a row goes straight to the patient's bill.

export function Dues() {
  const { clinicSlug, clinic } = useAuth()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [searchFor, setSearchFor] = useState('')
  const [page, setPage] = useState(1)
  const [dues, setDues] = useState<DuesPage | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearchFor(query)
      setPage(1)
    }, 300)
    return () => window.clearTimeout(timer)
  }, [query])

  useEffect(() => {
    let cancelled = false
    billingApi
      .dues(searchFor, page)
      .then((data) => !cancelled && setDues(data))
      .catch((err) => !cancelled && setError(err instanceof ApiError ? err.message : 'Could not load the dues.'))
    return () => {
      cancelled = true
    }
  }, [searchFor, page])

  const first = dues && dues.count > 0 ? (dues.page - 1) * dues.pageSize + 1 : 0
  const last = dues ? Math.min(dues.page * dues.pageSize, dues.count) : 0

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10">
      <div className="flex flex-col gap-1">
        <h1>Dues</h1>
        <p className="text-ink-soft">
          {!dues
            ? 'Loading…'
            : dues.count === 0
              ? searchFor
                ? 'Nobody matching this search owes anything.'
                : 'Nobody owes the clinic anything.'
              : `${formatINR(dues.totalPaise)} owed by ${dues.count} ${dues.count === 1 ? 'patient' : 'patients'}`}
        </p>
      </div>

      {error && <p className="rounded-lg bg-crit-soft px-3.5 py-2.5 text-body text-crit">{error}</p>}

      <div className="relative">
        <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, phone, or patient ID"
          aria-label="Search dues"
          className="w-full min-w-0 rounded-lg border border-rule bg-white py-2.5 pl-10 pr-3.5 text-body text-ink placeholder:text-ink-faint outline-none transition-colors duration-150 focus:border-accent focus:ring-2 focus:ring-accent-tint"
        />
      </div>

      {dues && dues.items.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-rule bg-white shadow-sm">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-rule">
                <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-ink-soft">Patient</th>
                <th className="hidden px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-ink-soft sm:table-cell">Phone</th>
                <th className="hidden px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-ink-soft md:table-cell">Last payment</th>
                <th className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-wider text-ink-soft">Owes</th>
                <th className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-wider text-ink-soft">Actions</th>
              </tr>
            </thead>
            <tbody>
              {dues.items.map((d) => {
                const path = clinicPath(clinicSlug, `patients/${d.patient.code}/bill`)
                return (
                  <tr
                    key={d.patient.id}
                    onClick={() => navigate(path)}
                    className="cursor-pointer border-b border-rule transition-colors last:border-none hover:bg-accent-tint/40"
                  >
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="font-medium text-ink">{d.patient.name}</span>
                        <span className="font-mono text-[12px] text-ink-faint">{d.patient.code}</span>
                      </div>
                    </td>
                    <td className="hidden px-4 py-3 text-ink-soft sm:table-cell">{d.patient.phone}</td>
                    <td className="hidden px-4 py-3 text-ink-soft md:table-cell">
                      {d.lastPaymentAt ? formatDate(d.lastPaymentAt, clinic?.timezone) : 'No payment yet'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-medium tabular-nums text-crit">{formatINR(d.outstandingPaise)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        <Link
                          to={path}
                          onClick={(e) => e.stopPropagation()}
                          aria-label={`Open ${d.patient.name}'s bill`}
                          className="whitespace-nowrap rounded-md bg-teal-soft px-2.5 py-1 text-[12px] font-medium text-teal transition-colors hover:bg-teal hover:text-white"
                        >
                          Open bill
                        </Link>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {dues && dues.count > dues.pageSize && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[13px] text-ink-soft">
            Showing {first} to {last} of {dues.count}
          </p>
          <ButtonRow>
            <Button variant="ghost" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <Button variant="secondary" disabled={last >= dues.count} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </ButtonRow>
        </div>
      )}
    </div>
  )
}
