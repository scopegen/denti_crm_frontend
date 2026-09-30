import type { ReactNode } from 'react'

/**
 * Every button in Denti sits on the right (docs/frontend-rules.md). Wrap buttons in this
 * row instead of aligning them by hand, and list the main action last so it lands
 * rightmost: <ButtonRow><Button variant="ghost">Cancel</Button><Button>Save</Button></ButtonRow>
 */
export function ButtonRow({ children, className = '' }: { children: ReactNode; className?: string }) {
  // ml-auto keeps the row on the right when it wraps below a title on a narrow screen.
  return <div className={`ml-auto flex flex-wrap items-center justify-end gap-3 ${className}`}>{children}</div>
}
