import { useEffect, useState, type ComponentType } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CalendarCheck, FileText, Images, IndianRupee, MessageCircle, ShieldCheck, Smile, Stethoscope } from 'lucide-react'
import { Button } from '../components/Button'
import { ButtonRow } from '../components/ButtonRow'
import { CircularCarousel, type CarouselItem } from '../components/CircularCarousel'
import { GradientWaves } from '../components/GradientWaves'
import { PillNav, type PillNavItem } from '../components/PillNav'
import { PlanCards } from '../components/PlanCards'
import { SiteFooter } from '../components/SiteFooter'
import { signupApi, type SignupPlans } from '../lib/signupApi'

// The home page at denti.in, for every clinic: what Denti does, the three plans, setting up a
// new clinic, and signing in to an existing one. Choosing a plan here opens sign up with that
// plan already picked. The page uses the full width of the screen: the hero runs edge to edge
// from the very top, with the pill nav floating over it, and everything else keeps only a small
// gutter so text never touches the edge.

const GUTTER = 'px-4 sm:px-6'

// Outside the component, so the nav's opening animation plays once, not on every render.
const NAV_ITEMS: PillNavItem[] = [
  { label: 'Home', href: '/' },
  { label: 'Features', href: '#features' },
  { label: 'Plans', href: '#plans' },
  { label: 'Set up your clinic', href: '/signup' },
]

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

type Feature = (typeof FEATURES)[number]

/** A feature on a solid light blue card with black text. On the ring, the card at the front
 * lightens and gets a brand blue edge (--cc-front), and cards turned away hide their text
 * (--cc-show); in the phone list neither is set, so every card shows plainly. */
function FeatureCard({ feature, className = '' }: { feature: Feature; className?: string }) {
  return (
    <div
      className={`relative flex flex-col border border-sky/30 bg-hero-to p-6 text-ink ${className}`}
      style={{ boxShadow: 'inset 0 0 0 calc(2px * var(--cc-front, 0)) #1e5f8c' }}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-[inherit] bg-white"
        style={{ opacity: 'calc(var(--cc-front, 0) * 0.6)' }}
      />
      <div className="relative flex flex-col gap-2.5" style={{ opacity: 'var(--cc-show, 1)' }}>
        <span className={`flex h-11 w-11 items-center justify-center rounded-full ${feature.tone}`}>
          <feature.icon size={20} />
        </span>
        <span className="text-[16px] font-medium">{feature.title}</span>
        <span className="text-body">{feature.text}</span>
      </div>
    </div>
  )
}

// Outside the component, so the ring keeps its cards between renders.
const FEATURE_SLIDES: CarouselItem[] = FEATURES.map((f) => ({
  id: f.title,
  label: f.title,
  content: <FeatureCard feature={f} className="h-full w-full" />,
}))

export function Landing() {
  const navigate = useNavigate()
  const [catalog, setCatalog] = useState<SignupPlans | null>(null)
  const [error, setError] = useState<string | null>(null)
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

  useEffect(() => {
    signupApi
      .plans()
      .then(setCatalog)
      // A visitor sees a plain sentence, never a server's error text such as "Bad Gateway".
      .catch(() => setError('The plans could not load just now. Please refresh the page in a minute.'))
  }, [])

  return (
    <div className="relative min-h-svh">
      <PillNav
        logo="/logo-mark.png"
        logoAlt="Denti"
        items={NAV_ITEMS}
        activeHref="/"
        baseColor="#ffffff"
        pillColor="transparent"
        pillTextColor="var(--color-accent-deep)"
        hoverColor="var(--color-accent-deep)"
        hoveredPillTextColor="var(--color-accent-deep)"
        logoSide="left"
        initialLoadAnimation={!reduceMotion}
      />

      <main className="flex flex-col gap-14 pb-16">
        <section className={`relative overflow-hidden bg-gradient-to-br from-hero-from to-hero-to pb-24 pt-36 sm:pb-36 sm:pt-48 ${GUTTER}`}>
          {/* Denti's blues: the light hero blue in the distance, the brand blue in the waves and
              pale sky on the crests. The gradient behind shows where the waves cannot be drawn. */}
          <div className="absolute inset-0" aria-hidden="true">
            <GradientWaves
              horizonColor="#2f8fe0"
              waveColor="#1e5f8c"
              crestColor="#c7e5fa"
              fogDepth={30}
              speed={reduceMotion ? 0 : 0.4}
              mouseInteraction={!reduceMotion}
              grain={false}
            />
          </div>
          {/* Centred by the user's choice: the one place on the home page where buttons are not on the right. */}
          <div className="relative z-10 mx-auto flex max-w-2xl flex-col items-center gap-4 text-center">
            <h1 className="text-[32px] font-bold leading-tight text-accent-deep sm:text-[40px]">Run your dental clinic in one place</h1>
            <p className="text-subheading text-ink-soft">
              Patients, consultations, prescriptions, treatments, bills, X-rays and WhatsApp reminders, made for walk in clinics.
              Set up your clinic in two minutes and start the same day.
            </p>
          </div>
          <div className="relative z-10 mt-6 flex flex-wrap items-center justify-center gap-3">
            <a href="#plans">
              <Button variant="secondary" className="!border-rule !bg-white/80 !text-ink">
                See the plans
              </Button>
            </a>
            <Link to="/signup">
              <Button>Set up your clinic</Button>
            </Link>
          </div>
        </section>

        <section id="features" className={`flex scroll-mt-24 flex-col gap-5 ${GUTTER}`} aria-labelledby="what-you-get">
          <h2 id="what-you-get" className="text-center text-heading font-medium text-ink">
            Everything your clinic does every day
          </h2>
          {/* Wide screens: the cards turn on a ring. Phones: the same cards as a list, since a
              ring would shrink them too small to read. The ring draws its cards for sight only,
              so a hidden list gives screen readers every card's text. */}
          <div className="hidden h-[400px] xl:block">
            <CircularCarousel
              items={FEATURE_SLIDES}
              ariaLabel="What Denti does"
              preset="cylinder"
              intro="rise"
              cardWidth={320}
              aspectRatio={1.35}
              gap={28}
              curve={0}
              speed={14}
              depthFade={0.5}
              fadeColor="#fbfcfe"
              innerShade={0.85}
              cornerRadius={16}
              frontScale={1.08}
            />
          </div>
          <ul className="sr-only hidden xl:block">
            {FEATURES.map((f) => (
              <li key={f.title}>
                {f.title}: {f.text}
              </li>
            ))}
          </ul>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:hidden">
            {FEATURES.map((f) => (
              <FeatureCard key={f.title} feature={f} className="rounded-xl" />
            ))}
          </div>
        </section>

        <section id="plans" className={`flex scroll-mt-24 flex-col gap-5 ${GUTTER}`} aria-labelledby="plans-title">
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

        <section className="mx-4 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-rule bg-white p-6 shadow-sm sm:mx-6">
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
      <SiteFooter />
    </div>
  )
}
