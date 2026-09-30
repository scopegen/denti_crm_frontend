import { useId, type ComponentType, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react'

// Ranco's floating label fields from its patient form: the label sits inside the field like a
// placeholder, then shrinks onto the top border once the field is focused or filled.
// Pure CSS, using the peer and :placeholder-shown pattern (placeholder=" " is required).

type IconType = ComponentType<{ size?: number; className?: string }>

const inputClass =
  'peer w-full rounded-lg border border-rule bg-white/90 py-3 pl-11 pr-4 text-body text-ink placeholder-transparent outline-none ' +
  'transition-colors duration-150 focus:border-accent focus:ring-2 focus:ring-accent-tint'

const floatedLabel =
  'peer-focus:top-0 peer-focus:left-4 peer-focus:-translate-y-1/2 peer-focus:rounded peer-focus:bg-white peer-focus:px-1 ' +
  'peer-focus:text-[11px] peer-focus:font-medium peer-focus:text-accent ' +
  'peer-[&:not(:placeholder-shown)]:top-0 peer-[&:not(:placeholder-shown)]:left-4 peer-[&:not(:placeholder-shown)]:-translate-y-1/2 ' +
  'peer-[&:not(:placeholder-shown)]:rounded peer-[&:not(:placeholder-shown)]:bg-white peer-[&:not(:placeholder-shown)]:px-1 ' +
  'peer-[&:not(:placeholder-shown)]:text-[11px] peer-[&:not(:placeholder-shown)]:font-medium peer-[&:not(:placeholder-shown)]:text-ink-soft'

function FloatingLabel({ label, required, top = false }: { label: string; required?: boolean; top?: boolean }) {
  const resting = top ? 'top-4' : 'top-1/2 -translate-y-1/2'
  return (
    <span className={`pointer-events-none absolute left-11 ${resting} text-body text-ink-faint transition-all duration-150 ${floatedLabel}`}>
      {label}
      {required && <span className="text-accent">*</span>}
    </span>
  )
}

export function FloatingField({
  label,
  icon: Icon,
  required,
  className = '',
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; icon: IconType }) {
  return (
    <label className="relative block">
      <Icon size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-faint" />
      <input required={required} placeholder=" " className={`${inputClass} ${className}`} {...props} />
      <FloatingLabel label={label} required={required} />
    </label>
  )
}

export function FloatingComboField({
  label,
  icon: Icon,
  required,
  options,
  className = '',
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; icon: IconType; options: readonly string[] }) {
  const listId = useId()
  return (
    <label className="relative block">
      <Icon size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-faint" />
      <input list={listId} required={required} placeholder=" " className={`${inputClass} ${className}`} {...props} />
      <datalist id={listId}>
        {options.map((option) => (
          <option key={option} value={option} />
        ))}
      </datalist>
      <FloatingLabel label={label} required={required} />
    </label>
  )
}

export function FloatingTextareaField({
  label,
  icon: Icon,
  required,
  className = '',
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; icon: IconType }) {
  return (
    <label className="relative block">
      <Icon size={18} className="pointer-events-none absolute left-4 top-4 text-ink-faint" />
      <textarea
        required={required}
        placeholder=" "
        className={`peer min-h-24 w-full resize-y rounded-2xl border border-rule bg-white/90 py-3.5 pl-11 pr-4 text-body text-ink placeholder-transparent outline-none transition-colors duration-150 focus:border-accent focus:ring-2 focus:ring-accent-tint ${className}`}
        {...props}
      />
      <FloatingLabel label={label} required={required} top />
    </label>
  )
}

/** For date and number inputs, whose own browser placeholder clashes with a floating label:
 * a small label sits above instead, same look otherwise. */
export function PillField({
  label,
  icon: Icon,
  required,
  className = '',
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; icon: IconType }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-body font-medium text-ink">
        {label}
        {required && <span className="ml-1 text-accent">*</span>}
      </span>
      <div className="relative">
        <Icon size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-faint" />
        <input
          required={required}
          className={`w-full rounded-lg border border-rule bg-white/90 py-3 pl-11 pr-4 text-body text-ink placeholder:text-ink-faint outline-none transition-colors duration-150 focus:border-accent focus:ring-2 focus:ring-accent-tint ${className}`}
          {...props}
        />
      </div>
    </label>
  )
}
