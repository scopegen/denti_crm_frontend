import { useState, type SubmitEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { Button } from '../../components/Button'
import { ButtonRow } from '../../components/ButtonRow'
import { Field, ReadOnlyField } from '../../components/Field'
import { SignatureSection } from '../../components/SignatureSection'
import { ApiError } from '../../lib/api'
import { clinicPath } from '../../lib/clinic'
import { orWords } from '../../lib/display'
import { useAuth } from '../../state/AuthContext'
import { ROLE_LABEL } from '../../types/auth'

// My account, for everyone signed in. Doctors add their own signature here; details such
// as name and registration number are changed by the owner or receptionist in Staff.
// Everyone changes their own password here.
export function Account() {
  const { staff, clinic, clinicSlug, logout, updateMe } = useAuth()
  const navigate = useNavigate()
  if (!staff) return null

  async function handleLogout() {
    await logout()
    navigate(clinicPath(clinicSlug))
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-10">
      <div className="flex flex-col gap-1">
        <h1>My account</h1>
        <p className="text-ink-soft">
          {ROLE_LABEL[staff.role]} at {clinic?.name}
        </p>
      </div>

      <div className="flex flex-col gap-4 rounded-xl border border-rule bg-white p-5 shadow-sm">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <ReadOnlyField label="Name" value={staff.name} />
          <ReadOnlyField label="Email" value={staff.email} />
        </div>
        {staff.treatsPatients && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <ReadOnlyField label="Qualification" value={orWords(staff.qualification, 'Not added')} />
            <ReadOnlyField label="Specialty" value={orWords(staff.specialty, 'Not added')} />
            <ReadOnlyField label="Registration No." value={orWords(staff.registrationNo, 'Not added')} />
          </div>
        )}
        <p className="text-[13px] text-ink-soft">
          {staff.role === 'doctor'
            ? 'To change these details, ask the clinic owner or receptionist.'
            : 'Change these details in Settings, Staff.'}
        </p>
        {staff.treatsPatients && <SignatureSection person={staff} onChange={updateMe} />}
      </div>

      <PasswordSection />

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

function PasswordSection() {
  const { changePassword } = useAuth()
  const [open, setOpen] = useState(false)
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [repeat, setRepeat] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  function close() {
    setOpen(false)
    setCurrent('')
    setNext('')
    setRepeat('')
    setError(null)
  }

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault()
    setError(null)
    if (next.length < 8) return setError('The new password needs at least 8 characters.')
    if (next !== repeat) return setError('The two new passwords are not the same.')
    setSaving(true)
    try {
      await changePassword(current, next)
      close()
      setNotice('Password changed. Any other device you were signed in on has been signed out.')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not change the password. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-rule bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-subheading font-medium text-ink">Password</h2>
          <p className="text-[13px] text-ink-soft">Changing it signs you out on your other devices.</p>
        </div>
        {!open && (
          <ButtonRow>
            <Button
              variant="secondary"
              onClick={() => {
                setNotice(null)
                setOpen(true)
              }}
            >
              Change password
            </Button>
          </ButtonRow>
        )}
      </div>
      {notice && <p className="rounded-lg bg-ok-soft px-3.5 py-2.5 text-body text-ok">{notice}</p>}
      {open && (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error && <p className="rounded-lg bg-crit-soft px-3.5 py-2.5 text-body text-crit">{error}</p>}
          <Field
            label="Current password"
            required
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            autoFocus
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              label="New password"
              required
              type="password"
              autoComplete="new-password"
              hint="At least 8 characters"
              value={next}
              onChange={(e) => setNext(e.target.value)}
            />
            <Field
              label="New password again"
              required
              type="password"
              autoComplete="new-password"
              value={repeat}
              onChange={(e) => setRepeat(e.target.value)}
            />
          </div>
          <ButtonRow>
            <Button variant="ghost" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Change password'}
            </Button>
          </ButtonRow>
        </form>
      )}
    </div>
  )
}
