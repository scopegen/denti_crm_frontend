import { useCallback, useEffect, useState, type SubmitEvent } from 'react'
import { Pencil } from 'lucide-react'
import { BackTitle } from '../../components/BackTitle'
import { Button } from '../../components/Button'
import { ButtonRow } from '../../components/ButtonRow'
import { Field, SelectField } from '../../components/Field'
import { HistoryButton } from '../../components/HistoryButton'
import { Modal } from '../../components/Modal'
import { Pill } from '../../components/Pill'
import { SignatureSection } from '../../components/SignatureSection'
import { ApiError } from '../../lib/api'
import { clinicPath } from '../../lib/clinic'
import { settingsApi } from '../../lib/settingsApi'
import { useAuth } from '../../state/AuthContext'
import { ROLE_LABEL, type Staff } from '../../types/auth'

// Everyone who signs in to the clinic, laid out like Ranco's Doctors page. The owner and
// receptionist add people, edit their details and signatures, and deactivate them.
// Deactivating signs the person out everywhere at once; their records stay.

const ROLE_OPTIONS = [ROLE_LABEL.doctor, ROLE_LABEL.admin]

export function StaffPage() {
  const { clinicSlug, staff: me, updateMe } = useAuth()
  const [people, setPeople] = useState<Staff[] | null>(null)
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<Staff | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    settingsApi
      .staff()
      .then(setPeople)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load staff.'))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  function signatureChanged(updated: Staff) {
    setPeople((current) => current?.map((p) => (p.id === updated.id ? updated : p)) ?? null)
    if (updated.id === me?.id) updateMe(updated)
  }

  async function deactivate(person: Staff) {
    setError(null)
    try {
      await settingsApi.deactivateStaff(person.id)
      setConfirm(null)
      load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not deactivate this login.')
      setConfirm(null)
    }
  }

  // A login paused by a move to a smaller plan comes back when the plan has room.
  async function resume(person: Staff) {
    setError(null)
    try {
      await settingsApi.resumeStaff(person.id)
      load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not switch this login back on.')
    }
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-10">
      <div className="flex items-center justify-between gap-4">
        <BackTitle to={clinicPath(clinicSlug, 'settings')} label="Back to settings">
          Staff
        </BackTitle>
        {!adding && (
          <ButtonRow>
            <Button
              onClick={() => {
                setEditingId(null)
                setAdding(true)
              }}
            >
              + Add staff
            </Button>
          </ButtonRow>
        )}
      </div>

      {error && <p className="rounded-lg bg-crit-soft px-3.5 py-2.5 text-body text-crit">{error}</p>}

      {adding && (
        <NewStaffForm
          onSaved={() => {
            setAdding(false)
            load()
          }}
          onCancel={() => setAdding(false)}
        />
      )}

      <div className="flex flex-col gap-2">
        {people?.map((person) =>
          editingId === person.id ? (
            <EditStaffForm
              key={person.id}
              person={person}
              onSaved={() => {
                setEditingId(null)
                load()
              }}
              onCancel={() => setEditingId(null)}
              onSignatureChange={signatureChanged}
            />
          ) : (
            <div key={person.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-rule bg-white px-4 py-3 shadow-sm">
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="text-body font-medium text-ink">{person.name}</span>
                <span className="truncate text-[12px] text-ink-faint">
                  {person.email}
                  {person.registrationNo ? ` · Reg. No. ${person.registrationNo}` : ''}
                </span>
              </div>
              <ButtonRow>
                {person.treatsPatients && person.status === 'active' && !person.hasSignature && <Pill>No signature</Pill>}
                <Pill variant={person.role === 'owner' ? 'solid' : 'accent'}>{ROLE_LABEL[person.role]}</Pill>
                {person.status !== 'active' && <Pill>{person.status === 'paused' ? 'Paused' : 'Deactivated'}</Pill>}
                {person.status === 'paused' && (
                  <Button variant="secondary" className="!px-2.5 !py-1.5 text-[13px]" onClick={() => resume(person)}>
                    Switch back on
                  </Button>
                )}
                {person.status === 'active' && person.role !== 'owner' && person.id !== me?.id && (
                  <Button variant="ghost" className="!px-2.5 !py-1.5 text-[13px]" onClick={() => setConfirm(person)}>
                    Deactivate
                  </Button>
                )}
                <HistoryButton
                  title={`History of ${person.name}'s login`}
                  filters={{ entityType: 'staff', entityId: person.id }}
                  personId={person.id}
                  className="!px-2.5 !py-1.5 text-[13px]"
                />
                <button
                  type="button"
                  onClick={() => {
                    setAdding(false)
                    setEditingId(person.id)
                  }}
                  aria-label={`Edit ${person.name}`}
                  title="Edit"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-paper-raised hover:text-accent-deep"
                >
                  <Pencil size={15} />
                </button>
              </ButtonRow>
            </div>
          ),
        )}
      </div>

      {confirm && (
        <Modal title={`Deactivate ${confirm.name}?`} onClose={() => setConfirm(null)}>
          <p className="text-body text-ink-soft">
            {confirm.name} will be signed out everywhere and cannot sign in again. Everything they recorded stays.
          </p>
          <ButtonRow>
            <Button variant="ghost" onClick={() => setConfirm(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => deactivate(confirm)}>
              Deactivate
            </Button>
          </ButtonRow>
        </Modal>
      )}
    </div>
  )
}

function NewStaffForm({ onSaved, onCancel }: { onSaved: () => void; onCancel: () => void }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [roleLabel, setRoleLabel] = useState(ROLE_LABEL.doctor)
  const [password, setPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [qualification, setQualification] = useState('')
  const [specialty, setSpecialty] = useState('')
  const [registrationNo, setRegistrationNo] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isDoctor = roleLabel === ROLE_LABEL.doctor

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await settingsApi.addStaff({
        name,
        email,
        role: isDoctor ? 'doctor' : 'admin',
        password,
        phone,
        qualification: isDoctor ? qualification : '',
        specialty: isDoctor ? specialty : '',
        registrationNo: isDoctor ? registrationNo : '',
      })
      onSaved()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not add this person.')
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-xl border border-rule bg-white p-5 shadow-sm">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Full name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Dr Priya Nair" />
        <SelectField label="Role" options={ROLE_OPTIONS} value={roleLabel} onChange={(e) => setRoleLabel(e.target.value)} />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Email" required type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Field
          label="Password"
          required
          type="password"
          minLength={8}
          hint="At least 8 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <Field label="Phone" hint="Optional" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
      {isDoctor && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Qualification" hint="Optional" value={qualification} onChange={(e) => setQualification(e.target.value)} placeholder="BDS, MDS" />
          <Field label="Specialty" hint="Optional" value={specialty} onChange={(e) => setSpecialty(e.target.value)} placeholder="Orthodontist" />
          <Field label="Registration No." hint="Optional" value={registrationNo} onChange={(e) => setRegistrationNo(e.target.value)} placeholder="A-17490" />
        </div>
      )}
      <p className="text-[13px] text-ink-soft">They sign in with this email and password, then a code sent to the email.</p>
      {error && <p className="rounded-lg bg-crit-soft px-3.5 py-2.5 text-body text-crit">{error}</p>}
      <ButtonRow>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? 'Adding…' : 'Add staff'}
        </Button>
      </ButtonRow>
    </form>
  )
}

function EditStaffForm({
  person,
  onSaved,
  onCancel,
  onSignatureChange,
}: {
  person: Staff
  onSaved: () => void
  onCancel: () => void
  onSignatureChange: (updated: Staff) => void
}) {
  const [name, setName] = useState(person.name)
  const [phone, setPhone] = useState(person.phone ?? '')
  const [qualification, setQualification] = useState(person.qualification ?? '')
  const [specialty, setSpecialty] = useState(person.specialty ?? '')
  const [registrationNo, setRegistrationNo] = useState(person.registrationNo ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await settingsApi.updateStaff(person.id, { name, phone, qualification, specialty, registrationNo })
      onSaved()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save the changes.')
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-xl border border-rule bg-white p-5 shadow-sm">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Full name" required value={name} onChange={(e) => setName(e.target.value)} />
        <Field label="Phone" hint="Optional" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </div>
      {person.treatsPatients && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Qualification" hint="Optional" value={qualification} onChange={(e) => setQualification(e.target.value)} />
          <Field label="Specialty" hint="Optional" value={specialty} onChange={(e) => setSpecialty(e.target.value)} />
          <Field label="Registration No." hint="Optional" value={registrationNo} onChange={(e) => setRegistrationNo(e.target.value)} />
        </div>
      )}
      <p className="text-[13px] text-ink-soft">
        {person.email} · {ROLE_LABEL[person.role]}. Email and role stay the same; add a new login for a different person.
      </p>
      {person.treatsPatients && <SignatureSection person={person} onChange={onSignatureChange} />}
      {error && <p className="rounded-lg bg-crit-soft px-3.5 py-2.5 text-body text-crit">{error}</p>}
      <ButtonRow>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? 'Saving…' : 'Save changes'}
        </Button>
      </ButtonRow>
    </form>
  )
}
