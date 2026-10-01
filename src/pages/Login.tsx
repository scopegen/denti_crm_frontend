import { useEffect, useState, type SubmitEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Button } from '../components/Button'
import { ButtonRow } from '../components/ButtonRow'
import { Field } from '../components/Field'
import { api, ApiError } from '../lib/api'
import { clinicPath } from '../lib/clinic'
import { useAuth, type CodeChallenge } from '../state/AuthContext'

// A clinic's sign in page, at denti.in/<clinic>. Laid out like Ranco's sign in card.
// Two steps: email and password, then the 6 digit code sent by email.
// Buttons sit on the right, main action last.

function errorText(err: unknown): string {
  return err instanceof ApiError ? err.message : 'Something went wrong. Please try again.'
}

export function Login() {
  const { staff, loading, clinicSlug } = useAuth()
  const [clinicName, setClinicName] = useState<string | null>(null)
  const [clinicMissing, setClinicMissing] = useState(false)
  const [challenge, setChallenge] = useState<CodeChallenge | null>(null)

  useEffect(() => {
    api
      .get<{ name: string }>(`/auth/clinic/${clinicSlug}`)
      .then((clinic) => setClinicName(clinic.name))
      .catch((err) => setClinicMissing(err instanceof ApiError && err.status === 404))
  }, [clinicSlug])

  if (!loading && staff) return <Navigate to={clinicPath(clinicSlug, 'today')} replace />

  return (
    <div className="flex min-h-svh items-center justify-center px-6">
      <div className="flex w-full max-w-sm flex-col gap-5 rounded-xl border border-rule bg-white p-6 shadow-sm">
        <div className="flex flex-col items-center gap-1 pb-1 text-center">
          <span className="text-[26px] font-bold tracking-tight text-accent-deep">Denti</span>
          {clinicName && <span className="text-body text-ink-soft">{clinicName}</span>}
          <h1 className="pt-2 text-subheading font-medium">{challenge ? 'Check your email' : 'Staff sign in'}</h1>
        </div>

        {clinicMissing ? (
          <>
            <p className="rounded-lg bg-crit-soft px-3.5 py-2.5 text-body text-crit">
              We could not find a clinic at this address. Check the address your clinic gave you.
            </p>
            <ButtonRow>
              <Link to="/login">
                <Button variant="secondary">Find my clinic</Button>
              </Link>
            </ButtonRow>
          </>
        ) : challenge ? (
          <CodeStep challenge={challenge} onChallengeChange={setChallenge} onBack={() => setChallenge(null)} />
        ) : (
          <PasswordStep onCodeSent={setChallenge} />
        )}
      </div>
    </div>
  )
}

function PasswordStep({ onCodeSent }: { onCodeSent: (challenge: CodeChallenge) => void }) {
  const { login, clinicSlug } = useAuth()
  const navigate = useNavigate()
  // Set by the reset password page after a new password is saved.
  const notice = (useLocation().state as { notice?: string } | null)?.notice
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const challenge = await login(email, password)
      if (challenge) onCodeSent(challenge)
      else navigate(clinicPath(clinicSlug, 'today'))
    } catch (err) {
      setError(errorText(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {notice && !error && <p className="rounded-lg bg-ok-soft px-3.5 py-2.5 text-body text-ok">{notice}</p>}
      {error && <p className="rounded-lg bg-crit-soft px-3.5 py-2.5 text-body text-crit">{error}</p>}
      <Field label="Email" required type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
      <Field
        label="Password"
        required
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <ButtonRow>
        <Link to={clinicPath(clinicSlug, 'reset-password')}>
          <Button variant="ghost">Forgot password?</Button>
        </Link>
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Checking…' : 'Continue'}
        </Button>
      </ButtonRow>
    </form>
  )
}

function CodeStep({
  challenge,
  onChallengeChange,
  onBack,
}: {
  challenge: CodeChallenge
  onChallengeChange: (challenge: CodeChallenge) => void
  onBack: () => void
}) {
  const { verify, resend, clinicSlug } = useAuth()
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [trustDevice, setTrustDevice] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(challenge.resendAfterSeconds)

  useEffect(() => {
    setSecondsLeft(challenge.resendAfterSeconds)
    const timer = window.setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000)
    return () => window.clearInterval(timer)
  }, [challenge])

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault()
    setError(null)
    setNotice(null)
    setSubmitting(true)
    try {
      await verify(challenge.challengeId, code, trustDevice)
      navigate(clinicPath(clinicSlug, 'today'))
    } catch (err) {
      setError(errorText(err))
      setCode('')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleResend() {
    setError(null)
    try {
      const next = await resend(challenge.challengeId)
      onChallengeChange(next)
      setCode('')
      setNotice('We sent a new code. Only the newest code works.')
    } catch (err) {
      setError(errorText(err))
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <p className="text-center text-body text-ink-soft">
        We sent a 6 digit code to <span className="font-medium text-ink">{challenge.sentTo}</span>. It expires in 10 minutes.
      </p>
      {import.meta.env.DEV && (
        <p className="rounded-lg bg-accent-tint px-3.5 py-2.5 text-[13px] text-accent-deep">
          Local testing: no real email is sent. The code is printed in the backend window.
        </p>
      )}
      {notice && <p className="rounded-lg bg-ok-soft px-3.5 py-2.5 text-body text-ok">{notice}</p>}
      {error && <p className="rounded-lg bg-crit-soft px-3.5 py-2.5 text-body text-crit">{error}</p>}

      <Field
        label="Code"
        required
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="\d{6}"
        maxLength={6}
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
        className="text-center font-mono text-[20px] tracking-[0.4em]"
        autoFocus
      />

      <label className="flex items-center gap-2 text-body text-ink">
        <input type="checkbox" checked={trustDevice} onChange={(e) => setTrustDevice(e.target.checked)} className="h-4 w-4 accent-accent" />
        Trust this device for 30 days
      </label>

      <ButtonRow>
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button variant="secondary" onClick={handleResend} disabled={secondsLeft > 0}>
          {secondsLeft > 0 ? `Resend in ${secondsLeft}s` : 'Resend code'}
        </Button>
        <Button type="submit" disabled={submitting || code.length !== 6}>
          {submitting ? 'Signing in…' : 'Sign in'}
        </Button>
      </ButtonRow>
    </form>
  )
}
