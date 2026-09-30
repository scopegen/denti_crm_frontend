import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

// Page title with Ranco's round back arrow before it.
export function BackTitle({ to, label, children }: { to: string; label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <Link
        to={to}
        aria-label={label}
        title={label}
        className="flex items-center justify-center rounded-full border border-rule bg-white p-1.5 text-ink-soft transition-colors hover:text-accent-deep"
      >
        <ArrowLeft size={16} />
      </Link>
      <h1>{children}</h1>
    </div>
  )
}
