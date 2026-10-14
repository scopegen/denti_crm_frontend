import { useEffect, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '../../components/Button'
import { ButtonRow } from '../../components/ButtonRow'
import { LogoWide } from '../../components/Logo'
import { SiteFooter } from '../../components/SiteFooter'
import { COMPANY, type CompanyField } from '../../lib/company'

// The shared frame of the Terms, Privacy, Refunds and Contact pages: a plain top bar, the title
// with the date it last changed, readable text, and the site footer.

export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  useEffect(() => {
    document.title = `${title} · Denti`
    window.scrollTo(0, 0)
    return () => {
      document.title = 'Denti'
    }
  }, [title])

  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex items-center justify-between gap-4 border-b border-rule bg-white px-4 py-3 sm:px-6">
        <Link to="/" aria-label="Denti home">
          <LogoWide className="h-9" />
        </Link>
        <ButtonRow>
          <Link to="/signup">
            <Button>Set up your clinic</Button>
          </Link>
        </ButtonRow>
      </header>
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-10 sm:px-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-[28px] font-bold leading-tight text-accent-deep">{title}</h1>
          <p className="text-[13px] text-ink-faint">Last updated {COMPANY.updated}</p>
        </div>
        {children}
      </main>
      <SiteFooter />
    </div>
  )
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-subheading font-medium text-ink">{title}</h2>
      <div className="flex flex-col gap-3 text-body text-ink-soft [&_li]:ml-5 [&_li]:list-disc [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1.5">
        {children}
      </div>
    </section>
  )
}

/** One company fact from lib/company.ts, or a clear "To be added" until it is filled in. */
export function Fill({ field }: { field: CompanyField }) {
  const value = COMPANY[field]
  if (value) return <>{value}</>
  return <span className="rounded bg-warn-soft px-1.5 text-warn">To be added</span>
}

/** The support email as a link, or "To be added". */
export function SupportEmail() {
  if (!COMPANY.supportEmail) return <Fill field="supportEmail" />
  return (
    <a href={`mailto:${COMPANY.supportEmail}`} className="text-accent underline">
      {COMPANY.supportEmail}
    </a>
  )
}
