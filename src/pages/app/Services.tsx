import { useCallback, useEffect, useMemo, useState, type SubmitEvent } from 'react'
import { BackTitle } from '../../components/BackTitle'
import { Button } from '../../components/Button'
import { ButtonRow } from '../../components/ButtonRow'
import { Field, SelectField } from '../../components/Field'
import { HistoryButton } from '../../components/HistoryButton'
import { Pill } from '../../components/Pill'
import { ApiError } from '../../lib/api'
import { clinicPath } from '../../lib/clinic'
import { formatINR, paiseToRupeesInput, rupeesToPaise } from '../../lib/money'
import { SERVICE_KIND_LABEL, settingsApi, type Service, type ServiceInput, type ServiceKind } from '../../lib/settingsApi'
import { useAuth } from '../../state/AuthContext'

// The clinic's service catalog, laid out like Ranco's: grouped by category, each row with its
// price and an Edit button. Changing a price never changes treatments already added.

const GENERAL = 'General'
const NO_CATEGORY = 'No category (General)'
const NEW_CATEGORY = 'Add a new category'

export function Services() {
  const { clinicSlug } = useAuth()
  const [services, setServices] = useState<Service[] | null>(null)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    settingsApi
      .services(true)
      .then(setServices)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load services.'))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const grouped = useMemo(() => {
    const groups = new Map<string, Service[]>()
    for (const s of services ?? []) groups.set(s.category ?? GENERAL, [...(groups.get(s.category ?? GENERAL) ?? []), s])
    return [...groups.entries()].sort(([a], [b]) => (a === GENERAL ? 1 : b === GENERAL ? -1 : a.localeCompare(b)))
  }, [services])

  const categories = useMemo(
    () => [...new Set((services ?? []).map((s) => s.category).filter((c): c is string => Boolean(c)))].sort(),
    [services],
  )

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-10">
      <div className="flex items-center justify-between gap-4">
        <BackTitle to={clinicPath(clinicSlug, 'settings')} label="Back to settings">
          Services
        </BackTitle>
        {!adding && (
          <ButtonRow>
            <Button onClick={() => setAdding(true)}>+ Add service</Button>
          </ButtonRow>
        )}
      </div>

      {error && <p className="rounded-lg bg-crit-soft px-3.5 py-2.5 text-body text-crit">{error}</p>}

      {adding && (
        <ServiceForm
          categories={categories}
          onSave={async (input) => {
            await settingsApi.addService(input)
            setAdding(false)
            load()
          }}
          onCancel={() => setAdding(false)}
        />
      )}

      {services && services.length === 0 && <p className="text-ink-soft">No services yet. Add the treatments your clinic offers.</p>}

      <div className="flex flex-col gap-6">
        {grouped.map(([category, items]) => (
          <div key={category} className="flex flex-col gap-2">
            <p className="text-[11px] font-medium uppercase tracking-wider text-ink-faint">{category}</p>
            {items.map((s) => (
              <ServiceRow key={s.id} service={s} categories={categories} onSaved={load} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

function ServiceRow({ service, categories, onSaved }: { service: Service; categories: string[]; onSaved: () => void }) {
  const [editing, setEditing] = useState(false)

  if (editing) {
    return (
      <ServiceForm
        initial={service}
        categories={categories}
        onSave={async (input) => {
          await settingsApi.updateService(service.id, input)
          setEditing(false)
          onSaved()
        }}
        onCancel={() => setEditing(false)}
      />
    )
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-rule bg-white px-4 py-3 shadow-sm">
      <div className="flex flex-col gap-0.5">
        <span className="text-body font-medium text-ink">{service.name}</span>
        <span className="text-[12px] text-ink-faint">
          {formatINR(service.listedPricePaise ?? 0)} · {SERVICE_KIND_LABEL[service.kind]}
          {service.recallAfterMonths ? ` · Recall after ${service.recallAfterMonths} months` : ''}
        </span>
      </div>
      <ButtonRow>
        {service.active ? <Pill variant="solid">Active</Pill> : <Pill>Retired</Pill>}
        <HistoryButton title={`History of ${service.name}`} filters={{ entityType: 'service', entityId: service.id }} />
        <Button variant="ghost" onClick={() => setEditing(true)}>
          Edit
        </Button>
      </ButtonRow>
    </div>
  )
}

function ServiceForm({
  initial,
  categories,
  onSave,
  onCancel,
}: {
  initial?: Service
  categories: string[]
  onSave: (input: ServiceInput) => Promise<void>
  onCancel: () => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [categoryChoice, setCategoryChoice] = useState(initial?.category ?? NO_CATEGORY)
  const [newCategory, setNewCategory] = useState('')
  const [kind, setKind] = useState<ServiceKind>(initial?.kind ?? 'in_house')
  // This page is for the owner and receptionist, who always get prices.
  const [price, setPrice] = useState(initial ? paiseToRupeesInput(initial.listedPricePaise ?? 0) : '')
  const [recall, setRecall] = useState(initial?.recallAfterMonths ? String(initial.recallAfterMonths) : '')
  const [removesTooth, setRemovesTooth] = useState(initial?.removesTooth ?? false)
  const [active, setActive] = useState(initial?.active ?? true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault()
    const paise = rupeesToPaise(price)
    if (paise === null) {
      setError('Enter the price in rupees, for example 6500.')
      return
    }
    const category =
      categoryChoice === NO_CATEGORY ? null : categoryChoice === NEW_CATEGORY ? newCategory.trim() || null : categoryChoice
    setSaving(true)
    setError(null)
    try {
      await onSave({
        name,
        category,
        kind,
        listedPricePaise: paise,
        recallAfterMonths: recall ? Number(recall) : null,
        removesTooth,
        active,
      })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save the service.')
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-xl border border-rule bg-white p-5 shadow-sm">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Root canal treatment" />
        <SelectField
          label="Category"
          options={[NO_CATEGORY, ...categories, NEW_CATEGORY]}
          value={categoryChoice}
          onChange={(e) => setCategoryChoice(e.target.value)}
        />
      </div>
      {categoryChoice === NEW_CATEGORY && (
        <Field label="New category name" required value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="Orthodontics" />
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SelectField
          label="Done"
          options={[SERVICE_KIND_LABEL.in_house, SERVICE_KIND_LABEL.lab]}
          value={SERVICE_KIND_LABEL[kind]}
          onChange={(e) => setKind(e.target.value === SERVICE_KIND_LABEL.lab ? 'lab' : 'in_house')}
        />
        <Field label="Price (₹)" required inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="6500" />
        <Field
          label="Recall after (months)"
          hint="Optional"
          type="number"
          min="1"
          max="60"
          value={recall}
          onChange={(e) => setRecall(e.target.value)}
          placeholder="6"
        />
      </div>
      <label className="flex items-center gap-2 text-body text-ink">
        <input type="checkbox" checked={removesTooth} onChange={(e) => setRemovesTooth(e.target.checked)} className="h-4 w-4 accent-accent" />
        Removes the tooth (an extraction: the tooth shows as missing on the tooth chart once it is done)
      </label>
      <label className="flex items-center gap-2 text-body text-ink">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="h-4 w-4 accent-accent" />
        Active (untick to retire a service no longer offered)
      </label>
      {error && <p className="rounded-lg bg-crit-soft px-3.5 py-2.5 text-body text-crit">{error}</p>}
      <ButtonRow>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </ButtonRow>
    </form>
  )
}
