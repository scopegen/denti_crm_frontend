import { useState, type SubmitEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '../components/Button'
import { ButtonRow } from '../components/ButtonRow'
import { Field } from '../components/Field'
import { clinicPath, isValidClinicSlug } from '../lib/clinic'

// Signing in, at denti.in/login. Staff type their clinic's name as it appears in the web
// address and go to that clinic's own sign in page.
export function FindClinic() {
  const navigate = useNavigate()
  const [slug, setSlug] = useState('')
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: SubmitEvent) {
    e.preventDefault()
    const value = slug.trim().toLowerCase()
    if (!isValidClinicSlug(value)) {
      setError('Use the clinic name exactly as it appears in your web address, for example smile-dental.')
      return
    }
    navigate(clinicPath(value))
  }

  return (
    <div className="flex min-h-svh items-center justify-center px-6">
      <form onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col gap-5 rounded-xl border border-rule bg-white p-6 shadow-sm">
        <div className="flex flex-col items-center gap-1 pb-1 text-center">
          <Link to="/" className="text-[26px] font-bold tracking-tight text-accent-deep">
            Denti
          </Link>
          <h1 className="pt-2 text-subheading font-medium">Find your clinic</h1>
          <p className="text-body text-ink-soft">Enter your clinic's name as it appears in your Denti web address.</p>
        </div>

        {error && <p className="rounded-lg bg-crit-soft px-3.5 py-2.5 text-body text-crit">{error}</p>}

        <Field
          label="Clinic address"
          hint={`${window.location.host}/${slug.trim().toLowerCase() || 'your-clinic'}`}
          required
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          autoFocus
        />

        {import.meta.env.DEV && (
          <p className="rounded-lg bg-accent-tint px-3.5 py-2.5 text-[13px] text-accent-deep">
            Local testing: the demo clinic is smile-dental.
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
