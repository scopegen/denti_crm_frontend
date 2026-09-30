import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { AuditFilters } from '../lib/auditApi'
import { clinicPath } from '../lib/clinic'
import { useAuth } from '../state/AuthContext'
import { ActivityList } from './ActivityList'
import { Button } from './Button'
import { Modal } from './Modal'

// The History on a record: the Activity log for just that record, in a window. Only the owner
// sees the button, as only the owner may read the log.

export function HistoryButton({
  title,
  filters,
  personId,
  className = '',
}: {
  title: string
  filters: AuditFilters
  /** For a login: also link to everything this person did. */
  personId?: string
  className?: string
}) {
  const { staff, clinicSlug } = useAuth()
  const [open, setOpen] = useState(false)
  if (staff?.role !== 'owner') return null

  return (
    <>
      <Button variant="ghost" className={className} onClick={() => setOpen(true)}>
        History
      </Button>
      {open && (
        <Modal title={title} wide onClose={() => setOpen(false)}>
          <ActivityList filters={filters} showPatient={false} />
          {personId && (
            <Link to={`${clinicPath(clinicSlug, 'settings/activity')}?person=${personId}`} className="self-end text-body text-accent-deep hover:underline">
              Everything they did
            </Link>
          )}
        </Modal>
      )}
    </>
  )
}
