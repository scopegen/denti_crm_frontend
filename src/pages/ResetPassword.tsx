import { useEffect, useState, type SubmitEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '../components/Button'
import { ButtonRow } from '../components/ButtonRow'
import { Field } from '../components/Field'
import { api, ApiError } from '../lib/api'
import { clinicPath } from '../lib/clinic'
import { useAuth } from '../state/AuthContext'

// A forgotten password, at denti.in/<clinic>/reset-password: the email, then the 6 digit code
// sent to it and a new password. The same card as the sign in page. Setting the new password
// signs the person out on every device, so they sign in again afterwards.

interface Started {
  challengeId: string
  resendAfterSeconds: number
}

function errorText(err: unknown): string {
  return err instanceof ApiError ? err.message : 'Something went wrong. Please try again.'
}

export function ResetPassword() {
  const { clinicSlug } = useAuth()
  const [clinicName, setClinicName] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [started, setStarted] = useState<Started | null>(null)

  useEffect(() => {
    api
      .get<{ name: string }>(`/auth/clinic/${clinicSlug}`)
      .then((clinic) => setClinicName(clinic.name))
      .catch(() => setClinicName(null))
  }, [clinicSlug])

  async function requestCode(address: string): Promise<Started> {
    const res = await api.post<{ challenge_id: string; resend_after_seconds: number }>('/auth/password-reset', {
      clinic: clinicSlug,
      email: address,
    })
    return { challengeId: res.challenge_id, resendAfterSeconds: res.resend_after_seconds }
  }

  return (
    <div className="flex min-h-svh items-center justify-center px-6">
      <div className="flex w-full max-w-sm flex-col gap-5 rounded-xl border border-rule bg-white p-6 shadow-sm">
        <div className="flex flex-col items-center gap-1 pb-1 text-center">
          <span className="text-[26px] font-bold tracking-tight text-accent-deep">Denti</span>
          {clinicName && <span className="text-body text-ink-soft">{clinicName}</span>}
          <h1 className="pt-2 text-subheading font-medium">{started ? 'Set a new password' : 'Forgot your password?'}</h1>
        </div>
        {started ? (
          <NewPasswordStep
            email={email}
            started={started}
            onResend={async () => setStarted(await requestCode(email))}
            onBack={() => setStarted(null)}
          />
        ) : (
          <EmailStep
            email={email}
            onEmailChange={setEmail}
            onSent={async () => setStarted(await requestCode(email))}
          />
        )}
      </div>
    </div>
  )
}

function EmailStep({ email, onEmailChange, onSent }: { email: string; onEmailChange: (value: string) => void; onSent: () => Promise<void> }) {
  const { clinicSlug } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await onSent()
    } catch (err) {
      setError(errorText(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <p className="text-center text-body text-ink-soft">Enter the email you sign in with. We will send you a 6 digit code to set a new password.</p>
      {error && <p className="rounded-lg bg-crit-soft px-3.5 py-2.5 text-body text-crit">{error}</p>}
      <Field label="Email" required type="email" autoComplete="username" value={email} onChange={(e) => onEmailChange(e.target.value)} autoFocus />
      <ButtonRow>
        <Link to={clinicPath(clinicSlug)}>
          <Button variant="ghost">Back to sign in</Button>
        </Link>
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Sending…' : 'Send code'}
        </Button>
      </ButtonRow>
    </form>
  )
}

function NewPasswordStep({
  email,
  started,
  onResend,
  onBack,
}: {
  email: string
  started: Started
  onResend: () => Promise<void>
  onBack: () => void
}) {
  const { clinicSlug } = useAuth()
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [repeat, setRepeat] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(started.resendAfterSeconds)

  useEffect(() => {
    setSecondsLeft(started.resendAfterSeconds)
    const timer = window.setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000)
    return () => window.clearInterval(timer)
  }, [started])

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault()
    setError(null)
    setNotice(null)
    if (password.length < 8) return setError('The new password needs at least 8 characters.')
    if (password !== repeat) return setError('The two new passwords are not the same.')
    setSubmitting(true)
    try {
      await api.post('/auth/password-reset/confirm', {
        clinic: clinicSlug,
        challenge_id: started.challengeId,
        code,
        new_password: password,
      })
      navigate(clinicPath(clinicSlug), {
        replace: true,
        state: { notice: 'Your password is changed and every device was signed out. Sign in with your new password.' },
      })
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
      await onResend()
      setCode('')
      setNotice('We sent a new code. Only the newest code works.')
    } catch (err) {
      setError(errorText(err))
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <p className="text-center text-body text-ink-soft">
        If <span className="font-medium text-ink">{email}</span> has a login at this clinic, we sent a 6 digit code to it. It expires in 10
        minutes.
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
      <Field
        label="New password"
        required
        type="password"
        autoComplete="new-password"
        hint="At least 8 characters"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <Field
        label="New password again"
        required
        type="password"
        autoComplete="new-password"
        value={repeat}
        onChange={(e) => setRepeat(e.target.value)}
      />

      <ButtonRow>
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button variant="secondary" onClick={handleResend} disabled={secondsLeft > 0}>
          {secondsLeft > 0 ? `Resend in ${secondsLeft}s` : 'Resend code'}
        </Button>
        <Button type="submit" disabled={submitting || code.length !== 6}>
          {submitting ? 'Saving…' : 'Set password'}
        </Button>
      </ButtonRow>
    </form>
  )
}
