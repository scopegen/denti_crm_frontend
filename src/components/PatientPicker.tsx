import { useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import { patientsApi, type PatientSummary } from '../lib/patientsApi'

// Search and pick a patient by name, phone or patient ID. Searches on the server.
export function PatientPicker({ onPick }: { onPick: (patient: PatientSummary) => void }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PatientSummary[]>([])
  const [searched, setSearched] = useState(false)

  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      setSearched(false)
      return
    }
    let cancelled = false
    const timer = window.setTimeout(() => {
      patientsApi
        .list(query, 1, 6)
        .then((page) => {
          if (!cancelled) {
            setResults(page.items)
            setSearched(true)
          }
        })
        .catch(() => undefined)
    }, 250)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [query])

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, phone, or patient ID"
          aria-label="Search patients"
          autoFocus
          className="w-full rounded-lg border border-rule bg-white py-2.5 pl-10 pr-3.5 text-body text-ink placeholder:text-ink-faint outline-none transition-colors duration-150 focus:border-accent focus:ring-2 focus:ring-accent-tint"
        />
      </div>
      {results.length > 0 && (
        <ul className="flex flex-col divide-y divide-rule rounded-lg border border-rule">
          {results.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => onPick(p)}
                className="flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-accent-tint/50"
              >
                <span className="flex flex-col">
                  <span className="text-body font-medium text-ink">{p.name}</span>
                  <span className="text-[12px] text-ink-faint">{p.phone}</span>
                </span>
                <span className="font-mono text-[12px] text-ink-soft">{p.code}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {searched && results.length === 0 && <p className="text-[13px] text-ink-soft">No patient matches this search.</p>}
    </div>
  )
}
