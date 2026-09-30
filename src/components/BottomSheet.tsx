import type { ReactNode } from 'react'
import { X } from 'lucide-react'

// Ranco's patient sections: a sheet that slides up over the patient page, which stays
// underneath. Closing it (the X, or a click on the dimmed page) goes back to the patient.
export function BottomSheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <>
      <div className="fixed inset-0 z-30 bg-ink/40" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="fixed inset-x-0 bottom-0 z-40 mx-auto flex max-h-[88vh] w-full max-w-6xl flex-col gap-5 overflow-y-auto rounded-t-2xl bg-paper p-5 shadow-[0_-8px_30px_-8px_rgba(16,24,38,0.35)] [animation:sheet-slide-up_0.22s_ease-out] sm:p-6"
      >
        <div className="flex items-center justify-between gap-3 border-b border-rule pb-4">
          <h2 className="text-subheading font-medium text-ink">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            title="Close"
            className="flex items-center justify-center rounded-full border border-rule bg-white p-1.5 text-ink-soft transition-colors hover:text-accent-deep"
          >
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </>
  )
}
