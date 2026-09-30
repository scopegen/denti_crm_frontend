
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { Button } from './Button'
import { ButtonRow } from './ButtonRow'

// Draw a signature with a finger, pen or mouse, as in Ranco. The pad is white while
// drawing so the ink shows; the API turns the white into a see through background, so a
// drawn signature prints exactly like an uploaded photo of one.

const WIDTH = 640
const HEIGHT = 240

export function SignaturePad({ onSave, onCancel, saving }: { onSave: (dataUrl: string) => void; onCancel: () => void; saving?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawingRef = useRef(false)
  const lastPointRef = useRef<{ x: number; y: number } | null>(null)
  const [hasDrawn, setHasDrawn] = useState(false)

  useEffect(() => {
    fillWhite()
  }, [])

  function fillWhite() {
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, WIDTH, HEIGHT)
  }

  // The canvas draws at twice its shown size, so the printed signature stays sharp.
  function pointFor(e: ReactPointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    return { x: ((e.clientX - rect.left) / rect.width) * WIDTH, y: ((e.clientY - rect.top) / rect.height) * HEIGHT }
  }

  function start(e: ReactPointerEvent<HTMLCanvasElement>) {
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    drawingRef.current = true
    lastPointRef.current = pointFor(e)
  }

  function move(e: ReactPointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return
    const ctx = e.currentTarget.getContext('2d')
    const last = lastPointRef.current
    const point = pointFor(e)
    if (ctx && last) {
      ctx.strokeStyle = '#101826'
      ctx.lineWidth = 5
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.beginPath()
      ctx.moveTo(last.x, last.y)
      ctx.lineTo(point.x, point.y)
      ctx.stroke()
      if (!hasDrawn) setHasDrawn(true)
    }
    lastPointRef.current = point
  }

  function stop() {
    drawingRef.current = false
    lastPointRef.current = null
  }

  function clear() {
    fillWhite()
    setHasDrawn(false)
  }

  return (
    <div className="flex flex-col gap-3">
      <canvas
        ref={canvasRef}
        width={WIDTH}
        height={HEIGHT}
        aria-label="Signature pad. Draw your signature here."
        className="aspect-[8/3] w-full max-w-md touch-none self-end rounded-lg border border-rule bg-white shadow-sm"
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={stop}
        onPointerCancel={stop}
      />
      <ButtonRow>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="ghost" onClick={clear} disabled={!hasDrawn}>
          Clear
        </Button>
        <Button onClick={() => canvasRef.current && onSave(canvasRef.current.toDataURL('image/png'))} disabled={!hasDrawn || saving}>
          {saving ? 'Saving…' : 'Use this signature'}
        </Button>
      </ButtonRow>
    </div>
  )
}
