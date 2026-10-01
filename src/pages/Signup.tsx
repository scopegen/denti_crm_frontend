import { useEffect, useState, type SubmitEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Button } from '../components/Button'
import { ButtonRow } from '../components/ButtonRow'
import { Field } from '../components/Field'
import { PlanCards } from '../components/PlanCards'
import { ApiError } from '../lib/api'
import { clinicPath } from '../lib/clinic'
import { formatINR } from '../lib/money'
import type { PlanKey, PlanOption } from '../lib/planApi'
import { prefixFrom, signupApi, slugFrom, type SignupDetails, type SignupPlans, type SignupStarted } from '../lib/signupApi'

// A clinic signs up by itself, at denti.in/signup: choose a plan, give the clinic's and the
// owner's details, then confirm the owner's email with the code we send. Only then is the
// clinic created, and the owner lands in it signed in. Every plan starts with the Starter pack.

type Step = 'plan' | 'details' | 'code'

function errorText(err: unknown): string {
  return err instanceof ApiError ? err.message : 'Something went wrong. Please try again.'
}

const EMPTY: SignupDetails = {
  plan: 'standard',
  clinicName: '',
  slug: '',
  patientIdPrefix: '',
  ownerName: '',
  email: '',
  phone: '',
  password: '',
  ownerTreatsPatients: true,
}

const PLAN_KEYS: PlanKey[] = ['basic', 'standard', 'pro']

export function Signup() {
  // A plan chosen on the landing page (/signup?plan=pro) skips the first step.
  const [params] = useSearchParams()
  const fromLanding = PLAN_KEYS.find((k) => k === params.get('plan'))
  const [catalog, setCatalog] = useState<SignupPlans | null>(null)
  const [step, setStep] = useState<Step>(fromLanding ? 'details' : 'plan')
  const [details, setDetails] = useState<SignupDetails>({ ...EMPTY, plan: fromLanding ?? EMPTY.plan })
  const [started, setStarted] = useState<SignupStarted | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    signupApi
      .plans()
      .then(setCatalog)
      .catch((err) => setError(errorText(err)))
  }, [])

  const plan = catalog?.plans.find((p) => p.key === details.plan)

  return (
    <div className="min-h-svh px-4 py-10 sm:px-6">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <div className="flex flex-col items-center gap-1 text-center">
          <Link to="/" className="text-[26px] font-bold tracking-tight text-accent-deep">
            Denti
          </Link>
          <h1 className="pt-1 text-heading font-medium">Set up your clinic</h1>
          <p className="text-body text-ink-soft">
            {step === 'plan' && 'Step 1 of 3: choose your plan'}
            {step === 'details' && 'Step 2 of 3: your clinic and you'}
            {step === 'code' && 'Step 3 of 3: confirm your email'}
          </p>
        </div>

        {error && <p className="mx-auto w-full max-w-xl rounded-lg bg-crit-soft px-3.5 py-2.5 text-body text-crit">{error}</p>}
        {!catalog && !error && <p className="text-center text-ink-soft">Loading…</p>}

        {catalog && step === 'plan' && (
          <PlanCards
            catalog={catalog}
            chosen={details.plan}
            onChoose={(key) => {
              setDetails((d) => ({ ...d, plan: key }))
              setError(null)
              setStep('details')
            }}
          />
        )}
        {catalog && plan && step === 'details' && (
          <DetailsStep
            plan={plan}
            gstPercent={catalog.gstPercent}
            months={catalog.starterPackMonths}
            details={details}
            onChange={setDetails}
            onBack={() => setStep('plan')}
            onSent={(s) => {
              setStarted(s)
              setStep('code')
            }}
          />
        )}
        {plan && started && step === 'code' && (
          <CodeStep plan={plan} details={details} started={started} onStarted={setStarted} onBack={() => setStep('details')} />
        )}

        <p className="text-center text-body text-ink-soft">
          Already using Denti?{' '}
          <Link to="/login" className="font-medium text-accent-deep hover:underline">
            Sign in to your clinic
          </Link>
        </p>
      </div>
    </div>
  )
}

function DetailsStep({
  plan,
  gstPercent,
  months,
  details,
  onChange,
  onBack,
  onSent,
}: {
  plan: PlanOption
  gstPercent: number
  months: number
  details: SignupDetails
  onChange: (d: SignupDetails) => void
  onBack: () => void
  onSent: (s: SignupStarted) => void
}) {
  const [slugTouched, setSlugTouched] = useState(details.slug !== '')
  const [prefixTouched, setPrefixTouched] = useState(details.patientIdPrefix !== '')
  const [repeat, setRepeat] = useState(details.password)
  const [address, setAddress] = useState<{ slug: string; available: boolean; reason: string | null } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  function set<K extends keyof SignupDetails>(key: K, value: SignupDetails[K]) {
    const next = { ...details, [key]: value }
    if (key === 'clinicName' && !slugTouched) next.slug = slugFrom(String(value))
    if ((key === 'clinicName' || key === 'slug') && !prefixTouched) next.patientIdPrefix = prefixFrom(next.slug)
    onChange(next)
  }

  // Checks the web address a moment after typing stops.
  useEffect(() => {
    const slug = details.slug
    if (!slug) {
      setAddress(null)
      return
    }
    const timer = window.setTimeout(() => {
      signupApi
        .checkAddress(slug)
        .then((r) => setAddress({ slug, ...r }))
        .catch(() => setAddress(null))
    }, 400)
    return () => window.clearTimeout(timer)
  }, [details.slug])

  const gst = Math.round((plan.starterPackPaise * gstPercent) / 100)

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault()
    setError(null)
    if (details.password.length < 8) return setError('The password needs at least 8 characters.')
    if (details.password !== repeat) return setError('The two passwords are not the same.')
    if (address && address.slug === details.slug && !address.available) return setError(address.reason)
    setSending(true)
    try {
      onSent(await signupApi.start(details))
    } catch (err) {
      setError(errorText(err))
    } finally {
      setSending(false)
    }
  }

  const addressNote =
    address && address.slug === details.slug ? (address.available ? 'Available' : address.reason ?? 'Not available') : 'Small letters, numbers and hyphens'

  return (
    <form onSubmit={handleSubmit} className="mx-auto flex w-full max-w-xl flex-col gap-5 rounded-xl border border-rule bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg bg-accent-tint/60 px-4 py-3">
        <span className="text-body text-ink">
          <span className="font-medium">{plan.name}</span> · Starter pack for {months} months
        </span>
        <span className="text-body font-medium tabular-nums text-accent-deep">
          {formatINR(plan.starterPackPaise + gst)} <span className="text-[12px] font-normal text-ink-soft">with GST</span>
        </span>
      </div>

      <h2 className="text-subheading font-medium text-ink">Your clinic</h2>
      <Field label="Clinic name" required value={details.clinicName} onChange={(e) => set('clinicName', e.target.value)} autoFocus />
      <div className="flex flex-col gap-1.5">
        <Field
          label="Web address"
          required
          hint={`${window.location.host}/${details.slug || 'your-clinic'}`}
          value={details.slug}
          onChange={(e) => {
            setSlugTouched(true)
            set('slug', e.target.value.toLowerCase().replace(/\s+/g, '-'))
          }}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
        />
        <span className={`text-[12px] ${address && address.slug === details.slug ? (address.available ? 'text-ok' : 'text-crit') : 'text-ink-faint'}`}>
          {addressNote}
        </span>
      </div>
      <div className="flex flex-col gap-1.5">
        <Field
          label="Patient ID prefix"
          hint={`IDs like ${details.patientIdPrefix || 'CLINIC'}-0001`}
          value={details.patientIdPrefix}
          maxLength={12}
          onChange={(e) => {
            setPrefixTouched(true)
            set('patientIdPrefix', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))
          }}
        />
        <span className="text-[12px] text-ink-faint">It is printed on documents patients keep, so it cannot change after your first patient.</span>
      </div>

      <h2 className="pt-2 text-subheading font-medium text-ink">You, the owner</h2>
      <Field label="Your name" required value={details.ownerName} onChange={(e) => set('ownerName', e.target.value)} placeholder="Dr Meera Nair" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Email" required type="email" autoComplete="email" value={details.email} onChange={(e) => set('email', e.target.value)} />
        <Field label="Phone" hint="Optional" type="tel" value={details.phone} onChange={(e) => set('phone', e.target.value)} />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label="Password"
          required
          type="password"
          autoComplete="new-password"
          hint="At least 8 characters"
          value={details.password}
          onChange={(e) => set('password', e.target.value)}
        />
        <Field label="Password again" required type="password" autoComplete="new-password" value={repeat} onChange={(e) => setRepeat(e.target.value)} />
      </div>
      <label className="flex items-center gap-2 text-body text-ink">
        <input
          type="checkbox"
          checked={details.ownerTreatsPatients}
          onChange={(e) => set('ownerTreatsPatients', e.target.checked)}
          className="h-4 w-4 accent-accent"
        />
        I also treat patients
      </label>

      {error && <p className="rounded-lg bg-crit-soft px-3.5 py-2.5 text-body text-crit">{error}</p>}
      <ButtonRow>
        <Button variant="ghost" onClick={onBack} disabled={sending}>
          Back
        </Button>
        <Button type="submit" disabled={sending}>
          {sending ? 'Sending…' : 'Email me a code'}
        </Button>
      </ButtonRow>
    </form>
  )
}

function CodeStep({
  plan,
  details,
  started,
  onStarted,
  onBack,
}: {
  plan: PlanOption
  details: SignupDetails
  started: SignupStarted
  onStarted: (s: SignupStarted) => void
  onBack: () => void
}) {
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(started.resendAfterSeconds)

  useEffect(() => {
    setSecondsLeft(started.resendAfterSeconds)
    const timer = window.setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000)
    return () => window.clearInterval(timer)
  }, [started])

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault()
    setError(null)
    setCreating(true)
    try {
      const done = await signupApi.verify(started.signupId, code)
      // The sign in cookie is set; the clinic's pages pick it up.
      navigate(clinicPath(done.clinicSlug, 'today'), { replace: true })
    } catch (err) {
      setError(errorText(err))
      setCode('')
      setCreating(false)
    }
  }

  async function handleResend() {
    setError(null)
    try {
      onStarted(await signupApi.resend(started.signupId))
      setCode('')
      setNotice('We sent a new code. Only the newest code works.')
    } catch (err) {
      setError(errorText(err))
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto flex w-full max-w-md flex-col gap-5 rounded-xl border border-rule bg-white p-6 shadow-sm">
      <p className="text-center text-body text-ink-soft">
        We sent a 6 digit code to <span className="font-medium text-ink">{started.sentTo}</span>. It expires in 10 minutes.
      </p>
      {import.meta.env.DEV && (
        <p className="rounded-lg bg-accent-tint px-3.5 py-2.5 text-[13px] text-accent-deep">
          Local testing: no real email is sent. The code is printed in the backend window.
        </p>
      )}

      <div className="flex flex-col gap-1.5 rounded-lg bg-paper-raised px-4 py-3 text-body">
        <span className="font-medium text-ink">
          {details.clinicName} · {plan.name}
        </span>
        <div className="flex items-center justify-between text-ink-soft">
          <span>Starter pack</span>
          <span className="tabular-nums">{formatINR(started.amountPaise)}</span>
        </div>
        <div className="flex items-center justify-between text-ink-soft">
          <span>GST</span>
          <span className="tabular-nums">{formatINR(started.gstPaise)}</span>
        </div>
        <div className="flex items-center justify-between border-t border-rule pt-1.5 font-medium text-ink">
          <span>Total</span>
          <span className="tabular-nums">{formatINR(started.totalPaise)}</span>
        </div>
      </div>
      {started.paymentMethod === 'test' && (
        <p className="rounded-lg bg-accent-tint px-3.5 py-2.5 text-[13px] text-accent-deep">
          Test payment: online payment is not connected yet, so no money is taken.
        </p>
      )}
      {started.paymentMethod !== 'test' && (
        <p className="rounded-lg bg-warn-soft px-3.5 py-2.5 text-[13px] text-warn">
          Online payment opens soon. Your clinic starts straight away, and the Denti team will contact you to collect the payment.
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
      <ButtonRow>
        <Button variant="ghost" onClick={onBack} disabled={creating}>
          Back
        </Button>
        <Button variant="secondary" onClick={handleResend} disabled={secondsLeft > 0 || creating}>
          {secondsLeft > 0 ? `Resend in ${secondsLeft}s` : 'Resend code'}
        </Button>
        <Button type="submit" disabled={creating || code.length !== 6}>
          {creating ? 'Creating…' : 'Create my clinic'}
        </Button>
      </ButtonRow>
    </form>
  )
}
