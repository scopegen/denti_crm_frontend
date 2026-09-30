import type { ComponentType } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronRight, FileSpreadsheet, Gauge, History, LogOut, MessageCircle, Package, Users } from 'lucide-react'
import { clinicPath } from '../../lib/clinic'
import { useAuth } from '../../state/AuthContext'
import { ROLE_LABEL } from '../../types/auth'

// The Settings hub for the owner and receptionist, laid out like Ranco's: a list of
// sections, then signing out.
export function Settings() {
  const { staff, clinic, clinicSlug, logout } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    await logout()
    navigate(clinicPath(clinicSlug))
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-10">
      <div className="flex flex-col gap-1">
        <h1>Settings</h1>
        <p className="text-ink-soft">
          {clinic?.name} · {clinic ? clinic.plan[0].toUpperCase() + clinic.plan.slice(1) : ''} plan · Signed in as {staff?.name} (
          {staff ? ROLE_LABEL[staff.role] : ''})
        </p>
      </div>

      <div className="flex flex-col gap-2.5">
        <SettingsLink to={clinicPath(clinicSlug, 'settings/plan')} icon={Gauge} label="Plan and usage" tone="mint" />
        <SettingsLink to={clinicPath(clinicSlug, 'settings/services')} icon={Package} label="Services" tone="sky" />
        <SettingsLink to={clinicPath(clinicSlug, 'settings/staff')} icon={Users} label="Staff" tone="lavender" />
        {clinic && clinic.plan !== 'basic' && (
          <SettingsLink to={clinicPath(clinicSlug, 'settings/whatsapp')} icon={MessageCircle} label="WhatsApp" tone="mint" />
        )}
        <SettingsLink to={clinicPath(clinicSlug, 'settings/import')} icon={FileSpreadsheet} label="Import patients" tone="teal" />
        {staff?.role === 'owner' && (
          <SettingsLink to={clinicPath(clinicSlug, 'settings/activity')} icon={History} label="Activity log" tone="sky" />
        )}
      </div>

      <button
        type="button"
        onClick={handleLogout}
        className="flex items-center gap-4 rounded-xl border border-rule bg-white px-5 py-4 text-left shadow-sm transition-colors hover:bg-paper-raised"
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-crit-soft text-crit">
          <LogOut size={18} strokeWidth={2} />
        </span>
        <span className="flex-1 text-subheading font-medium text-crit">Sign out</span>
      </button>
    </div>
  )
}

const TONES = {
  sky: 'bg-sky-soft text-sky',
  lavender: 'bg-lavender-soft text-lavender',
  mint: 'bg-mint-soft text-mint',
  teal: 'bg-teal-soft text-teal',
}

function SettingsLink({
  to,
  icon: Icon,
  label,
  tone,
}: {
  to: string
  icon: ComponentType<{ size?: number; strokeWidth?: number }>
  label: string
  tone: keyof typeof TONES
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-4 rounded-xl border border-rule bg-white px-5 py-4 shadow-sm transition-colors hover:bg-paper-raised"
    >
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${TONES[tone]}`}>
        <Icon size={18} strokeWidth={2} />
      </span>
      <span className="flex-1 text-subheading font-medium text-ink">{label}</span>
      <ChevronRight size={18} className="shrink-0 text-ink-faint" />
    </Link>
  )
}
