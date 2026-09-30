import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { CalendarCheck, CircleUserRound, Gem, LogOut, Settings, Users, Wallet } from 'lucide-react'
import type { ReactNode } from 'react'
import { clinicPath } from '../lib/clinic'
import { useAuth } from '../state/AuthContext'
import { ROLE_LABEL } from '../types/auth'

const PLAN_LABEL = { basic: 'Basic', standard: 'Standard', pro: 'Pro' } as const

// The signed in shell, following Ranco's template: a gradient top bar, a sidebar on
// desktop and a bottom tab bar on phones. Rendered once and kept while moving between pages.
// As in Ranco, the owner and receptionist reach Settings from the top bar; doctors, who
// have no settings, get Sign out there instead. Everyone's name opens My account. The owner
// and receptionist also see the clinic's plan there, which opens Plan and usage.


const TOPBAR_GRADIENT =
  'bg-[linear-gradient(120deg,var(--color-accent-deep)_0%,var(--color-accent)_45%,var(--color-accent-deep)_100%)]'

const topBarLinkClass =
  'flex items-center gap-2 rounded-lg px-3 py-2 text-body font-medium text-white/90 transition-colors duration-150 hover:bg-white/10 hover:text-white'

function navLinkClass({ isActive }: { isActive: boolean }) {
  return isActive ? 'bg-accent-tint text-accent-deep' : 'text-ink-soft hover:bg-paper-raised hover:text-ink'
}

export function AppLayout() {
  const { staff, clinic, clinicSlug, logout } = useAuth()
  const navigate = useNavigate()
  const canSeeSettings = staff?.role === 'owner' || staff?.role === 'admin'
  // Dues are money, so the owner and receptionist see them; doctors do not.
  const navItems = [
    { to: clinicPath(clinicSlug, 'today'), label: 'Today', icon: CalendarCheck },
    { to: clinicPath(clinicSlug, 'patients'), label: 'Patients', icon: Users },
    ...(canSeeSettings ? [{ to: clinicPath(clinicSlug, 'dues'), label: 'Dues', icon: Wallet }] : []),
  ]

  async function handleLogout() {
    await logout()
    navigate(clinicPath(clinicSlug))
  }

  return (
    <div className="flex min-h-svh flex-col">
      {/* Fixed at 64px tall so the sticky sidebar below can sit exactly under it. */}
      <header className={`sticky top-0 z-20 hidden h-16 items-center justify-between px-6 shadow-sm md:flex ${TOPBAR_GRADIENT}`}>
        <Brand clinicName={clinic?.name} home={clinicPath(clinicSlug, 'today')} />
        <div className="flex items-center gap-2">
          {canSeeSettings && clinic && (
            <Link to={clinicPath(clinicSlug, 'settings/plan')} title="Plan and usage" className={topBarLinkClass}>
              <Gem size={16} strokeWidth={2} />
              {PLAN_LABEL[clinic.plan]} plan
            </Link>
          )}
          <Link to={clinicPath(clinicSlug, 'account')} title="My account" className={`${topBarLinkClass} py-1.5`}>
            <CircleUserRound size={20} strokeWidth={2} />
            <div className="flex flex-col leading-tight">
              <span className="text-body font-medium text-white">{staff?.name}</span>
              <span className="text-[12px] text-white/75">{staff ? ROLE_LABEL[staff.role] : ''}</span>
            </div>
          </Link>
          {canSeeSettings ? (
            <Link to={clinicPath(clinicSlug, 'settings')} className={topBarLinkClass}>
              <Settings size={17} strokeWidth={2} />
              Settings
            </Link>
          ) : (
            <button type="button" onClick={handleLogout} className={topBarLinkClass}>
              <LogOut size={17} strokeWidth={2} />
              Sign out
            </button>
          )}
        </div>
      </header>

      <header className={`relative z-20 flex items-center justify-between px-4 py-2 shadow-sm md:hidden ${TOPBAR_GRADIENT}`}>
        <Brand clinicName={clinic?.name} home={clinicPath(clinicSlug, 'today')} />
        <div className="flex items-center gap-4">
          <Link to={clinicPath(clinicSlug, 'account')} aria-label="My account" className="text-white/90">
            <CircleUserRound size={20} strokeWidth={2} />
          </Link>
          {canSeeSettings ? (
            <Link to={clinicPath(clinicSlug, 'settings')} aria-label="Settings" className="text-white/90">
              <Settings size={20} strokeWidth={2} />
            </Link>
          ) : (
            <button type="button" onClick={handleLogout} aria-label="Sign out" className="text-white/90">
              <LogOut size={20} strokeWidth={2} />
            </button>
          )}
        </div>
      </header>

      <div className="flex flex-1 flex-col md:flex-row">
        <aside className="sticky top-[64px] hidden h-[calc(100svh-64px)] w-60 shrink-0 flex-col gap-1 self-start overflow-y-auto border-r border-rule bg-sidebar p-4 md:flex">
          <nav className="flex flex-col gap-1">
            {navItems.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={(state) =>
                  `flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-body font-medium transition-colors duration-150 ${navLinkClass(state)}`
                }
              >
                <Icon size={17} strokeWidth={2} />
                {label}
              </NavLink>
            ))}
          </nav>
        </aside>

        <main className="flex-1 pb-24 md:pb-10">
          <Outlet />
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-10 flex border-t border-rule bg-white md:hidden">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={(state) =>
              `flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors duration-150 ${navLinkClass(state)}`
            }
          >
            <Icon size={20} strokeWidth={2} />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

// The clinic's logo replaces the name once clinic settings exist.
function Brand({ clinicName, home }: { clinicName?: string; home: string }): ReactNode {
  return (
    <Link to={home} aria-label="Go to Today" className="flex items-baseline gap-2 text-white">
      <span className="text-[20px] font-bold tracking-tight md:text-[22px]">Denti</span>
      {clinicName && <span className="hidden text-body text-white/80 sm:inline">{clinicName}</span>}
    </Link>
  )
}
