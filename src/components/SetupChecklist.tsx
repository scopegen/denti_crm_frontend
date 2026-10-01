import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, Circle } from 'lucide-react'
import { clinicPath } from '../lib/clinic'
import { patientsApi } from '../lib/patientsApi'
import { planApi, type PlanInfo } from '../lib/planApi'
import { whatsappApi } from '../lib/whatsappApi'
import { useAuth } from '../state/AuthContext'
import { Button } from './Button'
import { ButtonRow } from './ButtonRow'

// The owner's first steps after setting up a clinic, on the Today page: the logins the plan
// includes, their signature, prices, patients and WhatsApp. Each step ticks itself when done;
// the list goes away once everything is done, or when the owner hides it.

interface Item {
  key: string
  title: string
  text: string
  to: string
  done: boolean
  optional?: boolean
}

function seats(limit: number | null, word: string): string {
  if (limit === null) return `unlimited ${word} logins`
  return `${limit} ${word} ${limit === 1 ? 'login' : 'logins'}`
}

function storageKey(slug: string, name: string): string {
  return `denti:${slug}:setup:${name}`
}

function remembered(slug: string, name: string): boolean {
  try {
    return window.localStorage.getItem(storageKey(slug, name)) === 'yes'
  } catch {
    return false
  }
}

function remember(slug: string, name: string): void {
  try {
    window.localStorage.setItem(storageKey(slug, name), 'yes')
  } catch {
    // Private windows may refuse; the list simply shows again next time.
  }
}

export function SetupChecklist() {
  const { staff, clinic, clinicSlug } = useAuth()
  const [plan, setPlan] = useState<PlanInfo | null>(null)
  const [patients, setPatients] = useState<number | null>(null)
  const [reviewLink, setReviewLink] = useState<boolean | null>(null)
  const [hidden, setHidden] = useState(() => remembered(clinicSlug, 'hidden'))
  const [pricesChecked, setPricesChecked] = useState(() => remembered(clinicSlug, 'prices'))
  const whatsapp = clinic?.plan !== 'basic'

  useEffect(() => {
    if (hidden) return
    planApi.get().then(setPlan).catch(() => setPlan(null))
    patientsApi
      .stats()
      .then((s) => setPatients(s.total))
      .catch(() => setPatients(null))
    if (whatsapp) {
      whatsappApi
        .settings()
        .then((s) => setReviewLink(Boolean(s.googleReviewUrl)))
        .catch(() => setReviewLink(null))
    }
  }, [hidden, whatsapp])

  if (hidden || !staff || !clinic || !plan || patients === null) return null

  const limits = plan.plans.find((p) => p.key === plan.plan)
  const items: Item[] = [
    {
      key: 'reception',
      title: 'Add your receptionist',
      text: `Your ${plan.planName} plan includes ${seats(limits?.receptionists ?? null, 'receptionist')}. They take payments and run the front desk.`,
      to: 'settings/staff',
      done: plan.usage.receptionists.used > 0,
    },
    {
      key: 'doctors',
      title: 'Add your doctors',
      text: `Your plan includes ${seats(limits?.doctors ?? null, 'doctor')}. Skip this if you are the only dentist.`,
      to: 'settings/staff',
      done: plan.usage.doctors.used > 0,
      optional: true,
    },
    ...(staff.treatsPatients
      ? [
          {
            key: 'signature',
            title: 'Add your signature',
            text: 'It prints on your prescriptions. Sign on paper and upload a photo, or draw it on screen.',
            to: 'account',
            done: staff.hasSignature,
          },
        ]
      : []),
    {
      key: 'prices',
      title: 'Check your prices',
      text: 'Denti starts you with a typical price list. Change any price to match your clinic.',
      to: 'settings/services',
      done: pricesChecked,
    },
    {
      key: 'patients',
      title: 'Bring in your patients',
      text: 'Import your patient list from Excel, or register patients as they come in.',
      to: 'settings/import',
      done: patients > 0,
    },
    ...(whatsapp
      ? [
          {
            key: 'whatsapp',
            title: 'Set up WhatsApp messages',
            text: 'Choose English or Hindi, adjust the wording, and add your Google review link.',
            to: 'settings/whatsapp',
            done: Boolean(reviewLink),
          },
        ]
      : []),
  ]
  const done = items.filter((i) => i.done).length
  if (done === items.length) return null

  function hide() {
    remember(clinicSlug, 'hidden')
    setHidden(true)
  }

  return (
    <section aria-label="Get your clinic ready" className="flex flex-col gap-4 rounded-xl border border-accent/30 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-subheading font-medium text-ink">Get {clinic.name} ready</h2>
          <span className="text-[13px] text-ink-soft">
            {done} of {items.length} done
          </span>
        </div>
        <ButtonRow>
          <Button variant="ghost" className="!px-2.5 !py-1.5 text-[13px]" onClick={hide}>
            Hide
          </Button>
        </ButtonRow>
      </div>
      {plan.billing?.status === 'past_due' && (
        <p className="rounded-lg bg-warn-soft px-3.5 py-2.5 text-body text-warn">
          Your Starter pack payment is due. Online payment opens soon; until then the Denti team will contact you to collect it.
        </p>
      )}
      <ol className="flex flex-col divide-y divide-rule">
        {items.map((item) => (
          <li key={item.key} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div className="flex min-w-0 flex-1 items-start gap-3">
              {item.done ? (
                <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-ok" aria-label="Done" />
              ) : (
                <Circle size={20} className="mt-0.5 shrink-0 text-ink-faint" aria-label="Not done yet" />
              )}
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className={`text-body font-medium ${item.done ? 'text-ink-soft line-through' : 'text-ink'}`}>
                  {item.title}
                  {item.optional && !item.done && <span className="ml-2 text-[12px] font-normal text-ink-faint">Optional</span>}
                </span>
                <span className="text-[13px] text-ink-soft">{item.text}</span>
              </div>
            </div>
            {!item.done && (
              <ButtonRow>
                <Link
                  to={clinicPath(clinicSlug, item.to)}
                  onClick={() => {
                    if (item.key === 'prices') {
                      remember(clinicSlug, 'prices')
                      setPricesChecked(true)
                    }
                  }}
                >
                  <Button variant="secondary" className="!px-3.5 !py-1.5">
                    {item.key === 'reception' || item.key === 'doctors' ? 'Add' : 'Open'}
                  </Button>
                </Link>
              </ButtonRow>
            )}
          </li>
        ))}
      </ol>
    </section>
  )
}
