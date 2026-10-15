import { useEffect, useRef, useState, type SubmitEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '../components/Button'
import { ButtonRow } from '../components/ButtonRow'
import { Field } from '../components/Field'
import { LogoStacked } from '../components/Logo'
import { api } from '../lib/api'
import { clinicPath } from '../lib/clinic'

// Signing in, at denti.in/login. Staff type part of their clinic's name (or its web address, if
// they know it), choose their clinic from the matches, and go to that clinic's own sign in page.
// Each match shows its web address too, so two clinics with the same name can be told apart.

interface ClinicMatch {
  slug: string
  name: string
}

const MIN_LETTERS = 2
const NO_MATCH = "No clinic matches that name. Check the spelling, or ask your clinic's owner how the clinic is named in Denti."

export function FindClinic() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  // Null until a search has answered for what is typed now.
  const [matches, setMatches] = useState<ClinicMatch[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const latest = useRef(0)

  // Searches a moment after typing stops; only the answer for the latest text counts.
  useEffect(() => {
    const words = query.trim()
    const ticket = ++latest.current
    setError(null)
    setMatches(null)
    if (words.length < MIN_LETTERS) {
      setSearching(false)
      return
    }
    setSearching(true)
    const timer = window.setTimeout(() => {
      api
        .get<ClinicMatch[]>(`/auth/clinics?q=${encodeURIComponent(words)}`)
        .then((found) => {
          if (ticket === latest.current) setMatches(found)
        })
        .catch(() => {
          if (ticket === latest.current) setError('Clinics could not be searched just now. Please try again in a minute.')
        })
        .finally(() => {
          if (ticket === latest.current) setSearching(false)
        })
    }, 250)
    return () => window.clearTimeout(timer)
  }, [query])

  function handleSubmit(e: SubmitEvent) {
    e.preventDefault()
    if (query.trim().length < MIN_LETTERS) setError("Type at least 2 letters of your clinic's name.")
    else if (matches?.length === 1) navigate(clinicPath(matches[0].slug))
    else if (matches && matches.length > 1) setError('More than one clinic matches. Choose yours from the list.')
    else if (matches?.length === 0) setError(NO_MATCH)
  }

  return (
    <div className="flex min-h-svh items-center justify-center px-6">
      <form onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col gap-5 rounded-xl border border-rule bg-white p-6 shadow-sm">
        <div className="flex flex-col items-center gap-1 pb-1 text-center">
          <Link to="/" aria-label="Denti home">
            <LogoStacked className="h-20" />
          </Link>
          <h1 className="pt-2 text-subheading font-medium">Find your clinic</h1>
          <p className="text-body text-ink-soft">Type your clinic's name, then choose it.</p>
        </div>

        {error && <p className="rounded-lg bg-crit-soft px-3.5 py-2.5 text-body text-crit">{error}</p>}

        <Field
          label="Clinic name"
          hint={searching ? 'Searching…' : 'At least 2 letters'}
          required
          placeholder="Smile Dental"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          autoFocus
        />

        {matches && matches.length > 0 && (
          <ul aria-label="Matching clinics" className="flex flex-col divide-y divide-rule overflow-hidden rounded-lg border border-rule">
            {matches.map((c) => (
              <li key={c.slug}>
                <button
                  type="button"
                  onClick={() => navigate(clinicPath(c.slug))}
                  className="flex w-full flex-col items-start gap-0.5 px-3.5 py-2.5 text-left transition-colors hover:bg-paper-raised focus-visible:bg-paper-raised focus-visible:outline-none"
                >
                  <span className="text-body font-medium text-ink">{c.name}</span>
                  <span className="text-[12px] text-ink-faint">
                    {window.location.host}/{c.slug}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {matches?.length === 0 && !error && <p className="text-body text-ink-soft">{NO_MATCH}</p>}

        {import.meta.env.DEV && (
          <p className="rounded-lg bg-accent-tint px-3.5 py-2.5 text-[13px] text-accent-deep">
            Local testing: type Smile to find the demo clinic.
          </p>
        )}

        <ButtonRow>
          <Button type="submit">Continue</Button>
        </ButtonRow>

        <p className="border-t border-rule pt-4 text-center text-body text-ink-soft">
          New to Denti?{' '}
          <Link to="/signup" className="font-medium text-accent-deep hover:underline">
            Set up your clinic
          </Link>
        </p>
      </form>
    </div>
  )
}
