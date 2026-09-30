import { useCallback, useEffect, useState, type ComponentType } from 'react'
import { Link, useLocation, useNavigate, useOutlet, useOutletContext, useParams } from 'react-router-dom'
import { ArrowLeft, Calendar, ChevronRight, History, Home, Hourglass, Images, IndianRupee, MessageCircle, Pencil, Phone, PhoneCall, Plus, Smile, Stethoscope, UserRound } from 'lucide-react'
import { BottomSheet } from '../../components/BottomSheet'
import { Button } from '../../components/Button'
import { ButtonRow } from '../../components/ButtonRow'
import { Waves } from '../../components/HeroBackground'
import { Pill } from '../../components/Pill'
import { WhatsAppButton } from '../../components/WhatsAppButton'
import { calculateAge } from '../../lib/age'
import { ActivityList } from '../../components/ActivityList'
import { ApiError } from '../../lib/api'
import { clinicPath } from '../../lib/clinic'
import { formatDate } from '../../lib/date'
import { orWords } from '../../lib/display'
import { GENDER_LABEL, patientsApi, type Patient } from '../../lib/patientsApi'
import { todayApi } from '../../lib/todayApi'
import { useAuth } from '../../state/AuthContext'
import { FollowUps } from './FollowUps'

// A patient's page, at /<clinic>/patients/SMILE-0042, laid out like Ranco's: the hero card
// with medical conditions right under the name, the info tiles, then one card per section.
// A section opens as a bottom sheet over this page (its own web address, such as
// .../SMILE-0042/consultations), and closing it comes back here.

export interface PatientContext {
  patient: Patient
  reload: () => void
}

type Tone = 'sky' | 'orange' | 'lavender' | 'pink' | 'mint' | 'teal'

const TONES: Record<Tone, { card: string; icon: string }> = {
  sky: { card: 'bg-sky-soft', icon: 'text-sky' },
  orange: { card: 'bg-orange-soft', icon: 'text-orange' },
  lavender: { card: 'bg-lavender-soft', icon: 'text-lavender' },
  pink: { card: 'bg-pink-soft', icon: 'text-pink' },
  mint: { card: 'bg-mint-soft', icon: 'text-mint' },
  teal: { card: 'bg-teal-soft', icon: 'text-teal' },
}

interface Section {
  id: string
  label: string
  subtitle: string
  icon: ComponentType<{ size?: number }>
  tone: Tone
  /** Only on these plans; every plan when left out. */
  plans?: string[]
  /** Only for these roles; everyone when left out. */
  roles?: string[]
}

const SECTIONS: Section[] = [
  { id: 'consultations', label: 'Consultations', subtitle: 'Exams and prescriptions', icon: Calendar, tone: 'sky' },
  { id: 'treatments', label: 'Treatments', subtitle: 'Planned, in progress and done', icon: Stethoscope, tone: 'mint' },
  { id: 'tooth-chart', label: 'Tooth chart', subtitle: 'Problems and treatments on each tooth', icon: Smile, tone: 'pink', plans: ['standard', 'pro'] },
  { id: 'bill', label: 'Bill', subtitle: 'Charges, payments and dues', icon: IndianRupee, tone: 'teal', roles: ['owner', 'admin'] },
  { id: 'follow-ups', label: 'Follow ups', subtitle: 'Calls and expected visits', icon: PhoneCall, tone: 'orange' },
  { id: 'images', label: 'X-rays and photos', subtitle: 'X-rays, photos and documents', icon: Images, tone: 'lavender' },
  { id: 'messages', label: 'WhatsApp messages', subtitle: 'Messages sent and links shared', icon: MessageCircle, tone: 'mint', plans: ['standard', 'pro'] },
  { id: 'history', label: 'History', subtitle: 'Who opened or changed this record', icon: History, tone: 'sky', roles: ['owner'] },
]

export function PatientDetail() {
  const { code } = useParams<{ code: string }>()
  const { clinicSlug, clinic, staff } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [patient, setPatient] = useState<Patient | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [arriving, setArriving] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const load = useCallback(() => {
    if (!code) return
    patientsApi
      .get(code)
      .then(setPatient)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load this patient.'))
  }, [code])

  useEffect(() => {
    load()
  }, [load])

  // The open section (if any) gets the patient through the outlet's context.
  const outlet = useOutlet(patient ? ({ patient, reload: load } satisfies PatientContext) : null)

  async function handleArrived() {
    if (!patient) return
    setArriving(true)
    setNotice(null)
    setActionError(null)
    try {
      await todayApi.markArrived(patient.id)
      setNotice(`${patient.name} is on today's list as waiting.`)
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Could not mark the patient as arrived.')
    } finally {
      setArriving(false)
    }
  }

  if (error) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-4 px-6 py-16 text-center">
        <h1>{error}</h1>
        <ButtonRow>
          <Link to={clinicPath(clinicSlug, 'patients')}>
            <Button variant="secondary">Back to patients</Button>
          </Link>
        </ButtonRow>
      </div>
    )
  }
  if (!patient) return <p className="mx-auto max-w-6xl px-6 py-10 text-ink-soft">Loading…</p>

  const base = clinicPath(clinicSlug, `patients/${patient.code}`)
  const sections = SECTIONS.filter(
    (s) => (!s.plans || (clinic && s.plans.includes(clinic.plan))) && (!s.roles || (staff && s.roles.includes(staff.role))),
  )
  const openSection = sections.find((s) => location.pathname.endsWith(`/${s.id}`))
  const age = calculateAge(patient.dob, patient.birthYear)
  const initials =
    patient.name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase() || '?'
  const address = [patient.area, patient.city].filter(Boolean).join(', ')

  return (
    <div className="relative">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10">
        <div className="flex items-center gap-2">
          <Link
            to={clinicPath(clinicSlug, 'patients')}
            aria-label="Back to patients"
            className="flex items-center justify-center rounded-full border border-rule bg-paper-raised p-1.5 text-ink-soft transition-colors hover:text-accent-deep"
          >
            <ArrowLeft size={16} />
          </Link>
          <p className="rounded-md bg-white px-2.5 py-1 text-[12px] font-medium uppercase tracking-wider text-accent">Patients</p>
        </div>

        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-hero-from to-hero-to p-5 sm:p-6">
          <Waves />
          <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-center gap-4">
              <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-accent-deep text-heading font-bold text-white">
                {initials}
              </span>
              <div className="flex flex-col gap-1.5">
                <h1>{patient.name}</h1>
                <p className="font-mono text-body text-ink-soft">{patient.code}</p>
                {patient.medicalConditions.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {patient.medicalConditions.map((condition) => (
                      <Pill key={condition} variant="crit">
                        {condition}
                      </Pill>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <ButtonRow>
              <Button variant="secondary" className="!border-rule !text-ink" onClick={handleArrived} disabled={arriving}>
                {arriving ? 'Saving…' : 'Mark arrived'}
              </Button>
              {patient.whatsappConsent && <WhatsAppButton className="!bg-white/70" message={{ patientId: patient.id, kind: 'general' }} />}
              <Link to={`${base}/consultations`} state={{ openForm: true }}>
                <Button variant="secondary" className="inline-flex items-center gap-2 !border-rule !text-ink">
                  <Plus size={16} />
                  Add consultation
                </Button>
              </Link>
              <Link to={`${base}/edit`}>
                <Button variant="secondary" className="inline-flex items-center gap-2 !border-rule !text-ink">
                  <Pencil size={15} />
                  Edit
                </Button>
              </Link>
            </ButtonRow>
          </div>
        </div>

        {notice && <p className="rounded-lg bg-ok-soft px-3.5 py-2.5 text-body text-ok">{notice}</p>}
        {actionError && <p className="rounded-lg bg-crit-soft px-3.5 py-2.5 text-body text-crit">{actionError}</p>}

        <div className="grid grid-cols-2 gap-4 rounded-xl border border-rule bg-white p-4 sm:grid-cols-3 lg:grid-cols-5">
          <InfoTile icon={Home} label="Address" value={orWords(address)} />
          <InfoTile icon={Calendar} label="Date Added" value={formatDate(patient.registeredAt, clinic?.timezone)} />
          <InfoTile icon={Hourglass} label="Age" value={age === null ? 'Not added' : `${age} yrs`} />
          <InfoTile icon={UserRound} label="Gender" value={patient.gender ? GENDER_LABEL[patient.gender] : 'Not added'} />
          <InfoTile icon={Phone} label="Mobile Number" value={patient.phone} />
        </div>

        {patient.medicalHistory && (
          <div className="flex flex-col gap-1.5 rounded-xl border border-rule bg-white p-4">
            <span className="text-[12px] text-ink-faint">Medical history</span>
            <p className="whitespace-pre-line text-body text-ink">{patient.medicalHistory}</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          {sections.map((s) => (
            <Link
              key={s.id}
              to={`${base}/${s.id}`}
              className={`relative flex flex-col gap-2 rounded-xl p-4 shadow-sm transition-transform duration-150 hover:-translate-y-0.5 sm:gap-3 sm:p-5 ${TONES[s.tone].card}`}
            >
              <ChevronRight size={18} className="absolute right-3 top-3 text-ink-faint" />
              <span className={`flex h-10 w-10 items-center justify-center rounded-full bg-white/70 sm:h-11 sm:w-11 ${TONES[s.tone].icon}`}>
                <s.icon size={18} />
              </span>
              <div className="flex flex-col gap-0.5 pr-6">
                <span className="text-body font-medium text-ink sm:text-subheading">{s.label}</span>
                <span className="text-[13px] text-ink-soft">{s.subtitle}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {outlet && (
        <BottomSheet title={openSection?.label ?? ''} onClose={() => navigate(base)}>
          {outlet}
        </BottomSheet>
      )}
    </div>
  )
}

function InfoTile({ icon: Icon, label, value }: { icon: ComponentType<{ size?: number }>; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-tint text-accent-deep">
        <Icon size={18} />
      </span>
      <div className="flex min-w-0 flex-col">
        <span className="text-[12px] text-ink-faint">{label}</span>
        <span className="truncate text-body font-medium text-ink">{value}</span>
      </div>
    </div>
  )
}

export function FollowUpsSection() {
  const { patient } = useOutletContext<PatientContext>()
  return <FollowUps patientId={patient.id} />
}

// The patient's History: every view, download and change to this patient's records. Owner only.
export function PatientHistorySection() {
  const { patient } = useOutletContext<PatientContext>()
  return <ActivityList filters={{ patientId: patient.id }} showPatient={false} />
}
