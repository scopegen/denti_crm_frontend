import { Check } from 'lucide-react'
import { formatINR } from '../lib/money'
import type { PlanKey } from '../lib/planApi'
import type { SignupPlans } from '../lib/signupApi'
import { Button } from './Button'
import { ButtonRow } from './ButtonRow'

// The three plans side by side, each with its Starter pack price, logins, limits and what it
// includes. Used on the landing page and the first step of signing up.

export function PlanCards({
  catalog,
  chosen,
  onChoose,
}: {
  catalog: SignupPlans
  chosen?: PlanKey
  onChoose: (key: PlanKey) => void
}) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {catalog.plans.map((p) => {
        const included = catalog.features.filter((f) => f.plans.includes(p.key))
        const picked = p.key === chosen
        return (
          <section
            key={p.key}
            aria-label={p.name}
            className={`flex flex-col gap-4 rounded-xl border bg-white p-5 shadow-sm ${picked ? 'border-accent ring-2 ring-accent-tint' : 'border-rule'}`}
          >
            <div className="flex flex-col gap-1">
              <span className="text-subheading font-bold text-accent-deep">{p.name}</span>
              <span className="text-[26px] font-bold leading-tight text-ink">{formatINR(p.starterPackPaise)}</span>
              <span className="text-[13px] text-ink-soft">
                for your first {catalog.starterPackMonths} months, then {formatINR(p.monthlyPaise)} a month or {formatINR(p.yearlyPaise)} a
                year. Plus {catalog.gstPercent}% GST.
              </span>
            </div>
            <ul className="flex flex-col gap-1.5 text-body text-ink">
              <li>1 owner login, free</li>
              <li>{p.receptionists === null ? 'Unlimited receptionist logins' : `${p.receptionists} receptionist login`}</li>
              <li>{p.doctors === null ? 'Unlimited doctor logins' : `Up to ${p.doctors} doctor ${p.doctors === 1 ? 'login' : 'logins'}`}</li>
              <li>{p.patients === null ? 'Unlimited patients' : `${p.patients.toLocaleString('en-IN')} patients`}</li>
              <li>{p.storageGb} GB for X-rays and photos</li>
            </ul>
            <ul className="flex flex-1 flex-col gap-1.5 border-t border-rule pt-3 text-[13px] text-ink-soft">
              {included.map((f) => (
                <li key={f.label} className="flex items-start gap-2">
                  <Check size={15} className="mt-0.5 shrink-0 text-ok" />
                  {f.label}
                </li>
              ))}
            </ul>
            <ButtonRow>
              <Button variant={picked ? 'primary' : 'secondary'} onClick={() => onChoose(p.key)}>
                Choose {p.name}
              </Button>
            </ButtonRow>
          </section>
        )
      })}
    </div>
  )
}
