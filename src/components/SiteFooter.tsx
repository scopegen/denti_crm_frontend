import { Link } from 'react-router-dom'
import { COMPANY } from '../lib/company'

// The footer of Denti's public pages: the policies a payment gateway and a careful clinic look
// for, and who runs Denti.

const LINKS = [
  { to: '/terms', label: 'Terms' },
  { to: '/privacy', label: 'Privacy' },
  { to: '/terms/refunds', label: 'Refunds and cancellation' },
  { to: '/contact', label: 'Contact' },
]

export function SiteFooter() {
  return (
    <footer className="border-t border-rule bg-white">
      <div className="flex flex-col gap-3 px-4 py-6 text-[13px] text-ink-soft sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <span>
          © {new Date().getFullYear()} {COMPANY.legalName}. Denti is a product of {COMPANY.legalName}.
        </span>
        <nav aria-label="Policies" className="flex flex-wrap gap-x-5 gap-y-2">
          {LINKS.map((l) => (
            <Link key={l.to} to={l.to} className="hover:text-ink hover:underline">
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  )
}
