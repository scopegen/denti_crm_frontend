import type { KeyboardEvent, ReactNode } from 'react'
import type { ToothStatus } from '../lib/chartApi'
import { chartRows, toothLabel, toothName, toothType, type Dentition, type Numbering, type ToothType } from '../lib/teeth'

// The tooth chart drawn as teeth, from the prototype agreed for Denti: crowns and roots,
// upper row above lower, the patient's right on the left of the screen. Colours come from
// the statuses the server works out: red problem, amber planned or in progress, green
// done, grey dashed missing. Tap or press Enter on a tooth to select it.

const SIZES: Record<Dentition, Partial<Record<ToothType, { w: number; crown: number; root: number }>>> = {
  adult: {
    central: { w: 36, crown: 44, root: 38 },
    lateral: { w: 31, crown: 41, root: 36 },
    canine: { w: 34, crown: 45, root: 46 },
    premolar: { w: 37, crown: 39, root: 38 },
    molar: { w: 45, crown: 37, root: 32 },
  },
  child: {
    central: { w: 30, crown: 36, root: 26 },
    lateral: { w: 27, crown: 34, root: 24 },
    canine: { w: 29, crown: 37, root: 30 },
    molar: { w: 39, crown: 32, root: 24 },
  },
}

const LOOK: Record<ToothStatus | 'healthy', { body: string; groove: string }> = {
  healthy: { body: 'fill-white stroke-[#A3B0BC] [stroke-width:1.4]', groove: 'stroke-[#A3B0BC]' },
  problem: { body: 'fill-crit-soft stroke-crit [stroke-width:2]', groove: 'stroke-crit' },
  planned: { body: 'fill-warn-soft stroke-warn [stroke-width:2]', groove: 'stroke-warn' },
  done: { body: 'fill-ok-soft stroke-ok [stroke-width:2]', groove: 'stroke-ok' },
  missing: { body: 'fill-transparent stroke-ink-faint [stroke-width:1.4] [stroke-dasharray:4_3]', groove: 'hidden' },
}

export const STATUS_WORDS: Record<ToothStatus | 'healthy', string> = {
  healthy: 'No issues',
  problem: 'Problem',
  planned: 'Planned or in progress',
  done: 'Done',
  missing: 'Missing',
}

function crownPath(x: number, y: number, w: number, h: number, type: ToothType, upper: boolean): string {
  const r = Math.min(9, w / 4)
  if (type === 'canine') {
    return upper
      ? `M${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h * 0.68} L${x + w / 2},${y + h} L${x},${y + h * 0.68} V${y + r} Q${x},${y} ${x + r},${y} Z`
      : `M${x},${y + h * 0.32} L${x + w / 2},${y} L${x + w},${y + h * 0.32} V${y + h - r} Q${x + w},${y + h} ${x + w - r},${y + h} H${x + r} Q${x},${y + h} ${x},${y + h - r} Z`
  }
  return `M${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h - r} Q${x + w},${y + h} ${x + w - r},${y + h} H${x + r} Q${x},${y + h} ${x},${y + h - r} V${y + r} Q${x},${y} ${x + r},${y} Z`
}

function rootPaths(x: number, w: number, edge: number, length: number, count: number, upper: boolean): string[] {
  const inner = w * 0.72
  const start = x + (w - inner) / 2
  const each = inner / count
  const direction = upper ? -1 : 1
  return Array.from({ length: count }, (_, i) => {
    const left = start + i * each + each * 0.08
    const right = start + (i + 1) * each - each * 0.08
    const lean = count === 3 ? (i - 1) * 2 : count === 2 ? (i - 0.5) * 3 : 0
    const len = count === 3 && i === 1 ? length * 0.82 : length
    const apexX = (left + right) / 2 + lean
    const apex = edge + direction * len
    const middle = edge + direction * len * 0.55
    return `M${left},${edge} Q${left},${middle} ${apexX},${apex} Q${right},${middle} ${right},${edge} Z`
  })
}

function groovePath(x: number, y: number, w: number, h: number, type: ToothType): string | null {
  const cx = x + w / 2
  const cy = y + h / 2
  if (type === 'molar') return `M${x + w * 0.28},${cy} H${x + w * 0.72} M${cx},${cy - h * 0.2} V${cy + h * 0.2}`
  if (type === 'premolar') return `M${x + w * 0.32},${cy} H${x + w * 0.68}`
  return null
}

export function ToothChart({
  dentition,
  numbering,
  statuses,
  selected,
  onSelect,
  describe,
}: {
  dentition: Dentition
  numbering: Numbering
  statuses: Record<number, ToothStatus>
  selected: number | null
  onSelect: (tooth: number) => void
  /** Extra words for screen readers, such as the problems on the tooth. */
  describe?: (tooth: number) => string
}) {
  const sizes = SIZES[dentition]
  const rows = chartRows(dentition)
  const pad = 22
  const gap = 4
  const mid = 18
  const half = rows.upper.length / 2
  const widthOf = (tooth: number) => sizes[toothType(tooth)]!.w
  const halfWidth = rows.upper.slice(0, half).reduce((sum, t) => sum + widthOf(t), 0) + gap * (half - 1)
  const width = pad * 2 + halfWidth * 2 + mid
  const centre = width / 2
  const tallest = Math.max(...Object.values(sizes).map((s) => s!.crown + s!.root))
  const numberYUpper = 16
  const biteUpper = 30 + tallest
  const biteLower = biteUpper + 34
  const numberYLower = biteLower + tallest + 22
  const height = numberYLower + 10

  function keyDown(e: KeyboardEvent<SVGGElement>, tooth: number) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onSelect(tooth)
    }
  }

  const drawRow = (teeth: number[], upper: boolean): ReactNode[] => {
    let x = pad
    return teeth.map((tooth, i) => {
      if (i === half) x = centre + mid / 2
      const type = toothType(tooth)
      const { w, crown, root } = sizes[type]!
      const status = statuses[tooth] ?? 'healthy'
      const look = LOOK[status]
      const crownY = upper ? biteUpper - crown : biteLower
      const edge = upper ? crownY + 2 : crownY + crown - 2
      const roots = type === 'molar' ? (upper ? 3 : 2) : 1
      const ringY = upper ? crownY - root - 5 : crownY - 5
      const isSelected = selected === tooth
      const groove = groovePath(x, crownY, w, crown, type)
      const label = toothLabel(tooth, numbering)
      const extra = describe?.(tooth)
      const element = (
        <g
          key={tooth}
          role="button"
          tabIndex={0}
          aria-pressed={isSelected}
          aria-label={`Tooth ${label}, ${toothName(tooth)}, ${STATUS_WORDS[status]}${extra ? `, ${extra}` : ''}`}
          className="group cursor-pointer outline-none"
          onClick={() => onSelect(tooth)}
          onKeyDown={(e) => keyDown(e, tooth)}
        >
          <rect
            x={x - 4}
            y={ringY}
            width={w + 8}
            height={crown + root + 10}
            rx={10}
            className={`fill-accent-tint stroke-accent [stroke-width:1.5] transition-opacity ${
              isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-50 group-focus-visible:opacity-100'
            }`}
          />
          {rootPaths(x, w, edge, root, roots, upper).map((d, r) => (
            <path key={r} d={d} className={`${look.body} transition-colors`} />
          ))}
          <path d={crownPath(x, crownY, w, crown, type, upper)} className={`${look.body} transition-colors`} />
          {groove && <path d={groove} className={`fill-none [stroke-width:1.2] [stroke-linecap:round] opacity-80 ${look.groove}`} />}
          <text
            x={x + w / 2}
            y={upper ? numberYUpper : numberYLower}
            textAnchor="middle"
            className={`text-[12px] ${isSelected ? 'fill-accent font-bold' : 'fill-ink-soft font-medium'}`}
          >
            {label}
          </text>
        </g>
      )
      x += w + gap
      return element
    })
  }

  // On a phone the chart keeps a size that can be tapped; it scrolls sideways on its own
  // instead of shrinking the teeth, and the page itself never scrolls sideways.
  return (
    <div className="-mx-1 overflow-x-auto px-1">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="block h-auto w-full"
        style={{ maxWidth: width, minWidth: Math.min(width, 560) }}
        role="group"
        aria-label={dentition === 'adult' ? 'Adult teeth' : 'Milk teeth'}
      >
        <line x1={centre} y1={8} x2={centre} y2={height - 4} className="stroke-rule [stroke-width:1.5] [stroke-dasharray:5_5]" />
        <text x={pad} y={(biteUpper + biteLower) / 2 + 4} className="fill-ink-faint text-[11px]">
          Patient's right
        </text>
        <text x={width - pad} y={(biteUpper + biteLower) / 2 + 4} textAnchor="end" className="fill-ink-faint text-[11px]">
          Patient's left
        </text>
        {drawRow(rows.upper, true)}
        {drawRow(rows.lower, false)}
      </svg>
      {width > 560 && <p className="pt-1 text-[12px] text-ink-faint sm:hidden">Swipe the chart to see the other side.</p>}
    </div>
  )
}

/** The colour key, with how many teeth have each colour. */
export function ChartLegend({ dentition, statuses }: { dentition: Dentition; statuses: Record<number, ToothStatus> }) {
  const rows = chartRows(dentition)
  const counts: Record<ToothStatus | 'healthy', number> = { healthy: 0, problem: 0, planned: 0, done: 0, missing: 0 }
  for (const tooth of [...rows.upper, ...rows.lower]) counts[statuses[tooth] ?? 'healthy'] += 1
  const swatch: Record<ToothStatus | 'healthy', string> = {
    healthy: 'bg-white border-[#A3B0BC]',
    problem: 'bg-crit-soft border-crit',
    planned: 'bg-warn-soft border-warn',
    done: 'bg-ok-soft border-ok',
    missing: 'bg-transparent border-ink-faint border-dashed',
  }
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-[13px] text-ink-soft">
      {(['healthy', 'problem', 'planned', 'done', 'missing'] as const).map((key) => (
        <li key={key} className="flex items-center gap-1.5">
          <span className={`h-3.5 w-3.5 rounded border-2 ${swatch[key]}`} aria-hidden="true" />
          {STATUS_WORDS[key]} <span className="tabular-nums text-ink-faint">{counts[key]}</span>
        </li>
      ))}
    </ul>
  )
}
