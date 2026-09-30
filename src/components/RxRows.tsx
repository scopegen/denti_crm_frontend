import { Plus, X } from 'lucide-react'
import { Button } from './Button'
import { ButtonRow } from './ButtonRow'
import { RX_FREQUENCIES, type RxItem } from '../lib/clinicalApi'

// The medicines on a prescription, one row each, as in Ranco: the medicine typed in, the dose
// frequency from a fixed list, plus an optional dose and duration.

const inputClass =
  'w-full min-w-0 rounded-lg border border-rule bg-white px-3 py-2.5 text-body text-ink placeholder:text-ink-faint outline-none ' +
  'transition-colors duration-150 focus:border-accent focus:ring-2 focus:ring-accent-tint disabled:bg-paper-raised'

export const emptyRxItem = (): RxItem => ({ medicine: '', dose: null, frequency: 'BD', duration: null, instructions: null })

export function RxRows({ value, onChange, disabled = false }: { value: RxItem[]; onChange: (items: RxItem[]) => void; disabled?: boolean }) {
  function update(index: number, patch: Partial<RxItem>) {
    onChange(value.map((item, i) => (i === index ? { ...item, ...patch } : item)))
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-body font-medium text-ink">Medicines</span>
      {value.length === 0 && <p className="text-[13px] text-ink-faint">No medicines added.</p>}
      {value.map((item, i) => (
        <div key={i} className="grid grid-cols-2 gap-2 sm:grid-cols-[minmax(0,3fr)_minmax(0,1.3fr)_minmax(0,2fr)_minmax(0,1.3fr)_auto]">
          <input
            className={`${inputClass} col-span-2 sm:col-span-1`}
            value={item.medicine}
            onChange={(e) => update(i, { medicine: e.target.value })}
            placeholder="Amoxicillin"
            aria-label="Medicine"
            disabled={disabled}
          />
          <input
            className={inputClass}
            value={item.dose ?? ''}
            onChange={(e) => update(i, { dose: e.target.value || null })}
            placeholder="500 mg"
            aria-label="Dose"
            disabled={disabled}
          />
          <select
            className={inputClass}
            value={item.frequency ?? ''}
            onChange={(e) => update(i, { frequency: e.target.value || null })}
            aria-label="How often"
            disabled={disabled}
          >
            {RX_FREQUENCIES.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
          <input
            className={inputClass}
            value={item.duration ?? ''}
            onChange={(e) => update(i, { duration: e.target.value || null })}
            placeholder="5 days"
            aria-label="For how long"
            disabled={disabled}
          />
          {!disabled && (
            <button
              type="button"
              onClick={() => onChange(value.filter((_, j) => j !== i))}
              aria-label="Remove medicine"
              className="flex items-center justify-center justify-self-end rounded-[20px] bg-paper-raised p-2 text-ink-soft transition-colors hover:bg-crit-soft hover:text-crit"
            >
              <X size={15} />
            </button>
          )}
        </div>
      ))}
      {!disabled && (
        <ButtonRow>
          <Button variant="secondary" className="flex items-center gap-1.5" onClick={() => onChange([...value, emptyRxItem()])}>
            <Plus size={14} /> Add medicine
          </Button>
        </ButtonRow>
      )}
    </div>
  )
}
