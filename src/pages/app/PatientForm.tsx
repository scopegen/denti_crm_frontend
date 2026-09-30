import { useEffect, useMemo, useState, type SubmitEvent } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Building2, CalendarDays, ChevronDown, ChevronUp, ClipboardList, HeartPulse, Mail, MapPin, Phone, UserRound } from 'lucide-react'
import { Button } from '../../components/Button'
import { ButtonRow } from '../../components/ButtonRow'
import { FloatingComboField, FloatingField, FloatingTextareaField, PillField } from '../../components/FloatingField'
import { Waves } from '../../components/HeroBackground'
import { calculateAge } from '../../lib/age'
import { ApiError } from '../../lib/api'
import { clinicPath } from '../../lib/clinic'
import { todayInZone } from '../../lib/date'
import { patientsApi, type Gender, type Patient, type PatientInput } from '../../lib/patientsApi'
import { todayApi } from '../../lib/todayApi'
import { useAuth } from '../../state/AuthContext'

// New and edit patient share this one form (as in Ranco): with a patient code in the address
// it edits, without one it registers. Laid out like Ranco's patient form.

type BirthMode = 'dob' | 'age' | 'year'

interface Draft {
  name: string
  phone: string
  city: string
  area: string
  birthMode: BirthMode
  dob: string
  age: string
  birthYear: string
  email: string
  gender: Gender | null
  height: string
  weight: string
  medicalConditions: string[]
  medicalHistory: string
  whatsappConsent: boolean
}

const emptyDraft: Draft = {
  name: '',
  phone: '',
  city: '',
  area: '',
  birthMode: 'dob',
  dob: '',
  age: '',
  birthYear: '',
  email: '',
  gender: null,
  height: '',
  weight: '',
  medicalConditions: [],
  medicalHistory: '',
  whatsappConsent: false,
}

const BIRTH_MODE_OPTIONS: { value: BirthMode; label: string }[] = [
  { value: 'dob', label: 'DOB' },
  { value: 'age', label: 'Age' },
  { value: 'year', label: 'Birth year only' },
]

const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
]

function toDraft(p: Patient): Draft {
  return {
    name: p.name,
    phone: p.phone,
    city: p.city ?? '',
    area: p.area ?? '',
    // Only a date of birth or a birth year is stored, so a birth year shows as "Birth year only".
    birthMode: p.dob ? 'dob' : 'year',
    dob: p.dob ?? '',
    age: '',
    birthYear: p.birthYear ? String(p.birthYear) : '',
    email: p.email ?? '',
    gender: p.gender,
    height: p.heightCm != null ? String(p.heightCm) : '',
    weight: p.weightKg != null ? String(p.weightKg) : '',
    medicalConditions: p.medicalConditions,
    medicalHistory: p.medicalHistory ?? '',
    whatsappConsent: p.whatsappConsent,
  }
}

function toInput(d: Draft): PatientInput {
  // An age typed on the form is sent as a birth year.
  let dob: string | null = null
  let birthYear: number | null = null
  if (d.birthMode === 'dob') dob = d.dob || null
  else if (d.birthMode === 'age') birthYear = d.age ? new Date().getFullYear() - Number(d.age) : null
  else birthYear = d.birthYear ? Number(d.birthYear) : null
  return {
    name: d.name,
    phone: d.phone,
    email: d.email,
    gender: d.gender,
    dob,
    birthYear,
    city: d.city,
    area: d.area,
    heightCm: d.height ? Number(d.height) : null,
    weightKg: d.weight ? Number(d.weight) : null,
    medicalConditions: d.medicalConditions,
    medicalHistory: d.medicalHistory,
    whatsappConsent: d.whatsappConsent,
  }
}

interface DuplicateMatch {
  code: string
  name: string
}

export function PatientForm() {
  const { code } = useParams<{ code: string }>()
  const isEditing = Boolean(code)
  const { clinicSlug, clinic } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const arriveAfter = (location.state as { markArrived?: boolean; doctorId?: string | null } | null)?.markArrived
    ? { doctorId: (location.state as { doctorId?: string | null }).doctorId ?? null }
    : null

  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [editing, setEditing] = useState<Patient | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [duplicates, setDuplicates] = useState<DuplicateMatch[] | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [conditionOptions, setConditionOptions] = useState<string[]>([])
  const [cityOptions, setCityOptions] = useState<string[]>([])
  const [showPhysical, setShowPhysical] = useState(false)
  const [showMedical, setShowMedical] = useState(false)

  const whatsappAvailable = clinic?.plan === 'standard' || clinic?.plan === 'pro'
  const backTo = isEditing && code
    ? clinicPath(clinicSlug, `patients/${code}`)
    : clinicPath(clinicSlug, arriveAfter ? 'today' : 'patients')

  useEffect(() => {
    patientsApi.picklist('medical_condition').then(setConditionOptions).catch(() => setConditionOptions([]))
    patientsApi.picklist('city').then(setCityOptions).catch(() => setCityOptions([]))
  }, [])

  useEffect(() => {
    if (!code) return
    patientsApi
      .get(code)
      .then((p) => {
        setEditing(p)
        setDraft(toDraft(p))
        // Details already on file are shown open, not hidden behind a click.
        setShowPhysical(p.heightCm != null || p.weightKg != null)
        setShowMedical(p.medicalConditions.length > 0 || Boolean(p.medicalHistory))
      })
      .catch((err) => setLoadError(err instanceof ApiError ? err.message : 'Could not load this patient.'))
  }, [code])

  const age = useMemo(() => {
    if (draft.birthMode === 'dob') return calculateAge(draft.dob)
    if (draft.birthMode === 'age') return draft.age ? Number(draft.age) : null
    return calculateAge(null, draft.birthYear ? Number(draft.birthYear) : null)
  }, [draft.birthMode, draft.dob, draft.age, draft.birthYear])

  function update<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }))
  }

  function toggleCondition(condition: string) {
    setDraft((prev) => ({
      ...prev,
      medicalConditions: prev.medicalConditions.includes(condition)
        ? prev.medicalConditions.filter((c) => c !== condition)
        : [...prev.medicalConditions, condition],
    }))
  }

  async function save(allowDuplicatePhone: boolean) {
    setSubmitting(true)
    setError(null)
    try {
      if (editing) {
        const updated = await patientsApi.update(editing.id, toInput(draft))
        navigate(clinicPath(clinicSlug, `patients/${updated.code}`))
      } else {
        const added = await patientsApi.create(toInput(draft), allowDuplicatePhone)
        if (arriveAfter) {
          // Registered from the Today page's Patient arrived window: mark them arrived and go back.
          await todayApi.markArrived(added.id, arriveAfter.doctorId)
          navigate(clinicPath(clinicSlug, 'today'))
        } else {
          navigate(clinicPath(clinicSlug, 'patients'), { state: { justAdded: added.name } })
        }
      }
    } catch (err) {
      if (err instanceof ApiError && err.data?.code === 'duplicate_phone') {
        setDuplicates((err.data.matches as DuplicateMatch[]) ?? [])
      } else {
        setError(err instanceof ApiError ? err.message : `Could not ${isEditing ? 'save' : 'add'} the patient.`)
      }
    } finally {
      setSubmitting(false)
    }
  }

  function handleSubmit(e: SubmitEvent) {
    e.preventDefault()
    setDuplicates(null)
    save(false)
  }

  if (loadError) {
    return (
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-6 py-16 text-center">
        <h1>{loadError}</h1>
      </div>
    )
  }
  if (isEditing && !editing) {
    return <p className="mx-auto max-w-6xl px-6 py-10 text-ink-soft">Loading patient…</p>
  }

  const submitLabel = submitting
    ? isEditing ? 'Saving…' : 'Adding…'
    : isEditing ? 'Save changes' : arriveAfter ? 'Add and mark arrived' : 'Add patient'
  const secondary = isEditing ? (
    <Button type="button" variant="ghost" onClick={() => navigate(backTo)}>
      Cancel
    </Button>
  ) : (
    <Button type="button" variant="ghost" onClick={() => setDraft(emptyDraft)}>
      Clear
    </Button>
  )

  return (
    // The gradient background stays in view while the form scrolls over it (a grid stack, as in Ranco).
    <div className="grid">
      <div className="sticky top-0 col-start-1 row-start-1 h-svh overflow-hidden bg-gradient-to-br from-hero-from to-hero-to">
        <Waves tall />
      </div>

      <div className="relative z-10 col-start-1 row-start-1">
        <div className="relative z-10 mx-auto flex max-w-6xl flex-col gap-8 px-6 pb-10 pt-10 md:pb-28">
          <header className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Link
                to={backTo}
                aria-label={isEditing ? 'Back to patient' : 'Back to patients'}
                className="flex items-center justify-center rounded-full border border-rule bg-white/80 p-1.5 text-ink-soft transition-colors hover:text-accent-deep"
              >
                <ArrowLeft size={16} />
              </Link>
              <p className="rounded-md bg-white px-2.5 py-1 text-[12px] font-medium uppercase tracking-wider text-accent">Patients</p>
            </div>
            <div className="flex items-center gap-4">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white/70 text-accent-deep">
                <HeartPulse size={26} />
              </span>
              <h1>{isEditing ? `Edit ${editing?.name ?? 'patient'}` : 'Patient Information'}</h1>
            </div>
          </header>

          {error && <p className="rounded-lg bg-crit-soft px-3.5 py-2.5 text-body text-crit">{error}</p>}

          {duplicates && (
            <div className="flex flex-col gap-3 rounded-xl border border-warn bg-warn-soft px-4 py-3 text-body text-warn">
              <p>
                A patient with this phone number is already registered:{' '}
                {duplicates.map((m, i) => (
                  <span key={m.code}>
                    {i > 0 && ', '}
                    <Link to={clinicPath(clinicSlug, `patients/${m.code}`)} className="font-medium underline">
                      {m.name} ({m.code})
                    </Link>
                  </span>
                ))}
                . Family members often share a number. Register this patient anyway?
              </p>
              <ButtonRow>
                <Button variant="ghost" onClick={() => setDuplicates(null)}>
                  Cancel
                </Button>
                <Button onClick={() => save(true)} disabled={submitting}>
                  Register anyway
                </Button>
              </ButtonRow>
            </div>
          )}

          <form id="patient-form" onSubmit={handleSubmit} className="flex flex-col gap-8">
            <div className="flex flex-col gap-5">
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <FloatingField label="Full name" icon={UserRound} required value={draft.name} onChange={(e) => update('name', e.target.value)} />
                <FloatingField label="Phone" icon={Phone} required type="tel" value={draft.phone} onChange={(e) => update('phone', e.target.value)} />
              </div>

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <FloatingComboField label="City" icon={MapPin} options={cityOptions} value={draft.city} onChange={(e) => update('city', e.target.value)} />
                <FloatingField label="Area or sector" icon={Building2} value={draft.area} onChange={(e) => update('area', e.target.value)} />
              </div>

              <FloatingField label="Email" icon={Mail} type="email" value={draft.email} onChange={(e) => update('email', e.target.value)} />

              <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
                <div className="flex flex-wrap items-start gap-5">
                  <div className="flex flex-col gap-1.5">
                    <span className="text-body font-medium text-ink">
                      DOB <span className="text-accent">*</span>
                    </span>
                    <div className="inline-flex w-fit rounded-lg border border-rule bg-white/70 p-1">
                      {BIRTH_MODE_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => update('birthMode', opt.value)}
                          className={`rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors ${
                            draft.birthMode === opt.value ? 'bg-accent text-white shadow-sm' : 'text-ink-soft hover:text-ink'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex min-w-60 flex-1 gap-5">
                    <div className="min-w-0 flex-1">
                      {draft.birthMode === 'dob' && (
                        <PillField
                          label="DOB"
                          icon={CalendarDays}
                          required
                          type="date"
                          value={draft.dob}
                          onChange={(e) => update('dob', e.target.value)}
                          max={todayInZone(clinic?.timezone)}
                        />
                      )}
                      {draft.birthMode === 'age' && (
                        <PillField label="Age" icon={CalendarDays} required type="number" min="0" max="130" value={draft.age} onChange={(e) => update('age', e.target.value)} placeholder="42" />
                      )}
                      {draft.birthMode === 'year' && (
                        <PillField
                          label="Birth year"
                          icon={CalendarDays}
                          required
                          type="number"
                          min="1900"
                          max={new Date().getFullYear()}
                          value={draft.birthYear}
                          onChange={(e) => update('birthYear', e.target.value)}
                          placeholder="1984"
                        />
                      )}
                    </div>
                    <div className="w-28 shrink-0">
                      <span className="mb-1.5 block text-body font-medium text-ink">Age</span>
                      <div className="flex items-center gap-2 rounded-lg border border-accent bg-accent-tint px-3.5 py-2.5 text-body text-accent-deep">
                        <UserRound size={16} className="shrink-0" />
                        {age === null ? 'Not set' : `${age}`}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <span className="text-body font-medium text-ink">Gender</span>
                  <div className="flex flex-wrap gap-2.5">
                    {GENDER_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => update('gender', opt.value)}
                        className={`rounded-lg border px-4 py-2 text-body font-medium transition-colors ${
                          draft.gender === opt.value ? 'border-accent bg-accent-tint text-accent-deep' : 'border-rule bg-white/70 text-ink-soft hover:text-ink'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {whatsappAvailable && (
                <label className="flex w-fit items-center gap-2 rounded-lg bg-white/70 px-3.5 py-2.5 text-body text-ink">
                  <input
                    type="checkbox"
                    checked={draft.whatsappConsent}
                    onChange={(e) => update('whatsappConsent', e.target.checked)}
                    className="h-4 w-4 accent-accent"
                  />
                  Patient agrees to receive reminders on WhatsApp
                </label>
              )}
            </div>

            <div className="flex flex-col gap-5">
              <div className="flex items-center justify-between">
                <span className="text-body font-medium text-ink">Physical details</span>
                <Button
                  variant="secondary"
                  className="flex items-center gap-1.5 !rounded-lg !border-rule !bg-white/70 !text-ink-soft"
                  onClick={() => setShowPhysical((v) => !v)}
                >
                  {showPhysical ? 'Show less' : 'More details'}
                  {showPhysical ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </Button>
              </div>
              {showPhysical && (
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <FloatingField label="Height (cm)" icon={UserRound} type="number" min="0" step="0.1" value={draft.height} onChange={(e) => update('height', e.target.value)} />
                  <FloatingField label="Weight (kg)" icon={UserRound} type="number" min="0" step="0.1" value={draft.weight} onChange={(e) => update('weight', e.target.value)} />
                </div>
              )}
            </div>

            <div className="flex flex-col gap-5">
              <div className="flex items-center justify-between">
                <span className="text-body font-medium text-ink">Medical details</span>
                <Button
                  variant="secondary"
                  className="flex items-center gap-1.5 !rounded-lg !border-rule !bg-white/70 !text-ink-soft"
                  onClick={() => setShowMedical((v) => !v)}
                >
                  {showMedical ? 'Show less' : 'More details'}
                  {showMedical ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </Button>
              </div>
              {showMedical && (
                <div className="flex flex-col gap-5">
                  <div className="flex flex-col gap-2">
                    <span className="text-body font-medium text-ink">Medical conditions</span>
                    <div className="grid grid-cols-1 gap-2.5 rounded-2xl bg-white/70 p-4 sm:grid-cols-2">
                      {conditionOptions.map((condition) => (
                        <label key={condition} className="flex items-start gap-2 text-body text-ink">
                          <input
                            type="checkbox"
                            checked={draft.medicalConditions.includes(condition)}
                            onChange={() => toggleCondition(condition)}
                            className="mt-0.5 h-4 w-4 shrink-0 accent-accent"
                          />
                          {condition}
                        </label>
                      ))}
                    </div>
                  </div>
                  <FloatingTextareaField
                    label="Medical history"
                    icon={ClipboardList}
                    value={draft.medicalHistory}
                    onChange={(e) => update('medicalHistory', e.target.value)}
                  />
                </div>
              )}
            </div>

            {/* Phones: the buttons sit at the end of the form. */}
            <ButtonRow className="pt-2 md:hidden">
              {secondary}
              <Button type="submit" disabled={submitting}>
                {submitLabel}
              </Button>
            </ButtonRow>
          </form>
        </div>

        {/* Desktop: the buttons stay pinned at the bottom right while the form scrolls. */}
        <div className="fixed inset-x-0 bottom-0 z-20 hidden md:left-60 md:block">
          <ButtonRow className="mx-auto max-w-6xl px-6 py-4">
            {secondary}
            <Button type="submit" form="patient-form" disabled={submitting}>
              {submitLabel}
            </Button>
          </ButtonRow>
        </div>
      </div>
    </div>
  )
}
