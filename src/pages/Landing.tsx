import { useEffect, useState, type ComponentType } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CalendarCheck, FileText, Images, IndianRupee, MessageCircle, ShieldCheck, Smile, Stethoscope } from 'lucide-react'
import { Button } from '../components/Button'
import { ButtonRow } from '../components/ButtonRow'
import { Waves } from '../components/HeroBackground'
import { PlanCards } from '../components/PlanCards'
import { ApiError } from '../lib/api'
import { signupApi, type SignupPlans } from '../lib/signupApi'

// The home page at denti.in, for every clinic: what Denti does, the three plans, setting up a
// new clinic, and signing in to an existing one. Choosing a plan here opens sign up with that
// plan already picked.

const FEATURES: { icon: ComponentType<{ size?: number }>; title: string; text: string; tone: string }[] = [
  {
    icon: CalendarCheck,
    title: 'Today, for walk in clinics',
    text: 'Who is expected, who has arrived, who is waiting and who has been seen, without appointments.',
    tone: 'bg-sky-soft text-sky',
  },
  {
    icon: Stethoscope,
    title: 'Consultations and treatments',
    text: 'Exams, prescriptions with the doctor’s signature, treatments with visits, and follow ups.',
    tone: 'bg-mint-soft text-mint',
  },
  {
    icon: Smile,
    title: 'Tooth chart',
    text: 'Problems, planned work and finished treatments on every tooth, adult and child.',
    tone: 'bg-pink-soft text-pink',
  },
  {
    icon: IndianRupee,
    title: 'One bill per patient',
    text: 'Charges, payments, dues, invoices and treatment estimates, with the money never edited.',
    tone: 'bg-teal-soft text-teal',
  },
  {
    icon: Images,
    title: 'X-rays and photos',
    text: 'Upload from the phone camera, view full size and keep everything on the patient’s record.',
    tone: 'bg-lavender-soft text-lavender',
  },
  {
    icon: MessageCircle,
    title: 'WhatsApp in one tap',
    text: 'Reminders, prescriptions, invoices and review requests, sent from your own number.',
    tone: 'bg-mint-soft text-mint',
  },
  {
    icon: FileText,
    title: 'Bring your patients',
    text: 'Import your patient list from Excel or other software, keeping your old patient numbers.',
    tone: 'bg-orange-soft text-orange',
  },
  {
    icon: ShieldCheck,
    title: 'Your clinic only',
    text: 'Every clinic’s data is kept apart, and the owner sees who opened or changed each record.',
    tone: 'bg-sky-soft text-sky',
  },
]

export function Landing() {
  const navigate = useNavigate()
  const [catalog, setCatalog] = useState<SignupPlans | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    signupApi
      .plans()
      .then(setCatalog)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load the plans.'))
  }, [])

  return (
    <div className="min-h-svh">
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <Link to="/" className="text-[24px] font-bold tracking-tight text-accent-deep">
          Denti
        </Link>
        <ButtonRow>
          <Link to="/login">
            <Button variant="ghost">Sign in</Button>
          </Link>
          <Link to="/signup">
            <Button>Set up your clinic</Button>
          </Link>
        </ButtonRow>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-14 px-4 pb-16 sm:px-6">
        <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-hero-from to-hero-to px-6 py-12 sm:px-10 sm:py-16">
          <Waves />
          <div className="relative z-10 flex max-w-2xl flex-col gap-4">
            <h1 className="text-[32px] font-bold leading-tight text-accent-deep sm:text-[40px]">Run your dental clinic in one place</h1>
            <p className="text-subheading text-ink-soft">
              Patients, consultations, prescriptions, treatments, bills, X-rays and WhatsApp reminders, made for walk in clinics.
              Set up your clinic in two minutes and start the same day.
            </p>
          </div>
          <div className="relative z-10 mt-6">
            <ButtonRow>
              <a href="#plans">
                <Button variant="secondary" className="!border-rule !bg-white/80 !text-ink">
                  See the plans
                </Button>
              </a>
              <Link to="/signup">
                <Button>Set up your clinic</Button>
              </Link>
            </ButtonRow>
          </div>
        </section>

        <section className="flex flex-col gap-5" aria-labelledby="what-you-get">
          <h2 id="what-you-get" className="text-heading font-medium text-ink">
            Everything your clinic does every day
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => (
              <div key={f.title} className="flex flex-col gap-2 rounded-xl border border-rule bg-white p-5 shadow-sm">
                <span className={`flex h-10 w-10 items-center justify-center rounded-full ${f.tone}`}>
                  <f.icon size={18} />
                </span>
                <span className="text-body font-medium text-ink">{f.title}</span>
                <span className="text-[13px] text-ink-soft">{f.text}</span>
              </div>
            ))}
          </div>
        </section>

        <section id="plans" className="flex scroll-mt-6 flex-col gap-5" aria-labelledby="plans-title">
          <div className="flex flex-col gap-1">
            <h2 id="plans-title" className="text-heading font-medium text-ink">
              Choose your plan
            </h2>
            <p className="text-body text-ink-soft">
              Every plan starts with a Starter pack for your first 3 months. The owner’s login is always free, and you add your receptionist
              and doctors yourself.
            </p>
          </div>
          {error && <p className="rounded-lg bg-crit-soft px-3.5 py-2.5 text-body text-crit">{error}</p>}
          {!catalog && !error && <p className="text-ink-soft">Loading…</p>}
          {catalog && <PlanCards catalog={catalog} onChoose={(key) => navigate(`/signup?plan=${key}`)} />}
        </section>

        <section className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-rule bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-1">
            <span className="text-subheading font-medium text-ink">Already using Denti?</span>
            <span className="text-body text-ink-soft">Sign in to your clinic with its web address.</span>
          </div>
          <ButtonRow>
            <Link to="/login">
              <Button variant="secondary">Sign in</Button>
            </Link>
          </ButtonRow>
        </section>
      </main>
    </div>
  )
}
