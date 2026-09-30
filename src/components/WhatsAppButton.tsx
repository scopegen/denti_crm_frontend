import { useState } from 'react'
import { MessageCircle } from 'lucide-react'
import { ApiError } from '../lib/api'
import { whatsappApi, type MessageRequest } from '../lib/whatsappApi'
import { useAuth } from '../state/AuthContext'
import { Button } from './Button'
import { ButtonRow } from './ButtonRow'
import { Modal } from './Modal'

// A WhatsApp button (Standard and Pro): opens WhatsApp on this phone or computer with the
// message already written, from the clinic's own number. The person presses send there.
// Hidden on the Basic plan.

export function WhatsAppButton({
  message,
  label = 'WhatsApp',
  className = '',
  onSent,
}: {
  message: MessageRequest
  label?: string
  className?: string
  onSent?: () => void
}) {
  const { clinic } = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if (!clinic || clinic.plan === 'basic') return null

  async function handleClick() {
    setBusy(true)
    // Opened straight away, while the tap still counts, so the browser does not block it;
    // the address is filled in once the message is written.
    const win = window.open('', '_blank')
    try {
      const { url } = await whatsappApi.open(message)
      if (win) win.location.href = url
      else window.location.href = url
      onSent?.()
    } catch (err) {
      win?.close()
      setError(err instanceof ApiError ? err.message : 'Could not open WhatsApp. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Button
        variant="secondary"
        className={`inline-flex items-center gap-1.5 !border-[#25D366]/50 !text-[#128C7E] ${className}`}
        onClick={handleClick}
        disabled={busy}
      >
        <MessageCircle size={15} />
        {busy ? 'Opening…' : label}
      </Button>
      {error && (
        <Modal title="Could not open WhatsApp" onClose={() => setError(null)}>
          <p className="text-body text-ink-soft">{error}</p>
          <ButtonRow>
            <Button onClick={() => setError(null)}>OK</Button>
          </ButtonRow>
        </Modal>
      )}
    </>
  )
}
