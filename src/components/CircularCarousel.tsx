import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
} from 'react'
import './CircularCarousel.css'

// CircularCarousel from React Bits (reactbits.dev), typed for Denti and changed to carry any
// content (the home page's feature cards) instead of photos. Cards sit on a ring that drifts,
// can be dragged or thrown, settles on a card, and turns a clicked card to the front. Arrow keys
// turn it too. It pauses off screen, and stands still for visitors who ask for less motion.
// The cards are drawn for sight only: the page must also give their text to screen readers.
//
// Each card's content can follow where the card is facing through two CSS variables:
// --cc-show (1 facing the viewer, falling to 0 as it turns side on) to hide text on cards that
// face away, and --cc-front (1 for the card at the front, 0 for the rest) to highlight it.

type Preset = 'cylinder' | 'orbit' | 'wheel' | 'panorama'
type Intro = 'assemble' | 'rise' | 'spin' | 'none'
type Autoplay = 'drift' | 'step' | 'off'

export interface CarouselItem {
  id: string
  /** Read out as the card's name, such as "Tooth chart". */
  label: string
  content: ReactNode
}

interface Layout {
  axis: 'x' | 'y'
  tilt: number
  perspective: number
  curve: number
  spread: number
  inward: boolean
  billboard: boolean
  backfaces: boolean
  window: number
}

const PRESETS: Record<Preset, Layout> = {
  cylinder: { axis: 'y', tilt: -5, perspective: 2500, curve: 1, spread: 1, inward: false, billboard: false, backfaces: true, window: 0 },
  orbit: { axis: 'y', tilt: -16, perspective: 1500, curve: 0, spread: 1.45, inward: false, billboard: true, backfaces: false, window: 0 },
  wheel: { axis: 'x', tilt: 0, perspective: 1800, curve: 0, spread: 1, inward: false, billboard: false, backfaces: true, window: 1.7 },
  panorama: { axis: 'y', tilt: 0, perspective: 0, curve: 1, spread: 1, inward: true, billboard: false, backfaces: false, window: 0 },
}

const INTRO_LENGTH: Record<Intro, number> = { assemble: 1500, rise: 1400, spin: 1800, none: 0 }
const TILES = 8
const OVERLAP = 2.5
const DRAG_THRESHOLD = 5
const SPRING = 118
const SETTLE_SPEED = 9
const TO_RAD = Math.PI / 180

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
const wrap = (degrees: number) => ((((degrees + 180) % 360) + 360) % 360) - 180
const easeOut = (t: number) => 1 - Math.pow(1 - t, 4)
const easeOutQuint = (t: number) => 1 - Math.pow(1 - t, 5)

type Point = [number, number, number]

const rotateX = (p: Point, degrees: number): Point => {
  const r = degrees * TO_RAD
  const c = Math.cos(r)
  const s = Math.sin(r)
  return [p[0], p[1] * c - p[2] * s, p[1] * s + p[2] * c]
}

const rotateY = (p: Point, degrees: number): Point => {
  const r = degrees * TO_RAD
  const c = Math.cos(r)
  const s = Math.sin(r)
  return [p[0] * c + p[2] * s, p[1], -p[0] * s + p[2] * c]
}

const usePrefersReducedMotion = () => {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const query = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (!query) return undefined
    const update = () => setReduced(query.matches)
    update()
    query.addEventListener?.('change', update)
    return () => query.removeEventListener?.('change', update)
  }, [])
  return reduced
}

interface Press {
  id: number
  x: number
  y: number
  angle: number
  moved: boolean
  origin: number
  samples: { time: number; angle: number }[]
}

interface RingState {
  angle: number
  velocity: number
  target: number | null
  dir: number
  press: Press | null
  drag: boolean
  hover: boolean
  pointer: { inside: boolean; x: number; y: number }
  yaw: number
  pitch: number
  intro: { type: Intro; start: number } | null
  introDone: boolean
  holdUntil: number
  stepAt: number
  suppressClick: boolean
  wheelTimer: number
  fit: number
  shift: number
  drop: number
  last: number
}

interface Tile {
  index: number
  total: number
  start: number
  end: number
  size: number
  move: string
}

interface CircularCarouselProps {
  items: CarouselItem[]
  /** Read out as the carousel's name. */
  ariaLabel?: string
  preset?: Preset
  intro?: Intro
  cardWidth?: number
  /** Card width divided by its height. */
  aspectRatio?: number
  gap?: number
  /** From flat (0) to fully wrapped around the ring (1). */
  curve?: number
  /** Camera angle in degrees; negative looks down onto the ring. */
  tilt?: number
  perspective?: number
  autoplay?: Autoplay
  /** Drift speed, in degrees per second. */
  speed?: number
  /** Seconds between moves when autoplay is "step". */
  interval?: number
  direction?: 'left' | 'right'
  draggable?: boolean
  momentum?: number
  snap?: boolean
  pauseOnHover?: boolean
  focusOnClick?: boolean
  parallax?: number
  stretch?: number
  /** How strongly cards fade into fadeColor as they turn away, from 0 to 1. */
  depthFade?: number
  /** Match it to the background behind the carousel. */
  fadeColor?: string
  /** Brightness of the backs of cards seen through the ring, from 0 to 1. */
  innerShade?: number
  cornerRadius?: number
  /** How much bigger the card at the front is drawn, such as 1.08. */
  frontScale?: number
  className?: string
  style?: CSSProperties
}

export function CircularCarousel({
  items,
  ariaLabel = 'Carousel',
  preset = 'cylinder',
  intro = 'rise',
  cardWidth = 220,
  aspectRatio = 1,
  gap = 25,
  curve,
  tilt,
  perspective,
  autoplay = 'drift',
  speed = 14,
  interval = 3,
  direction = 'left',
  draggable = true,
  momentum = 0.6,
  snap = true,
  pauseOnHover = true,
  focusOnClick = true,
  parallax = 0.3,
  stretch = 0.5,
  depthFade = 0.55,
  fadeColor = '#000000',
  innerShade = 0.6,
  cornerRadius = 12,
  frontScale = 1,
  className = '',
  style,
}: CircularCarouselProps) {
  const count = items.length
  const layout = PRESETS[preset] ?? PRESETS.cylinder
  const axis = layout.axis
  const tiltValue = tilt ?? layout.tilt
  const curveValue = layout.billboard ? 0 : clamp(curve ?? layout.curve, 0, 1)
  const reduced = usePrefersReducedMotion()

  const cardW = Math.max(40, cardWidth)
  const cardH = cardW / clamp(aspectRatio, 0.2, 5)
  const along = axis === 'x' ? cardH : cardW
  const step = 360 / Math.max(count, 1)

  const radius = useMemo(() => {
    const n = Math.max(count, 3)
    const pitch = (along + gap) * layout.spread
    const chord = pitch / (2 * Math.sin(Math.PI / n))
    const arc = (n * pitch) / (2 * Math.PI)
    return Math.max(chord + (arc - chord) * curveValue, along * 0.6)
  }, [count, along, gap, curveValue, layout.spread])

  // A bent card is drawn as several strips; a flat one (curve 0) as one piece.
  const tiles = useMemo<Tile[]>(() => {
    const total = curveValue > 0.001 ? TILES : 1
    const length = along / total
    const bend = curveValue > 0.001 ? radius / curveValue : 0
    return Array.from({ length: total }, (_, index) => {
      const start = index * length - (index > 0 ? OVERLAP / 2 : 0)
      const end = (index + 1) * length + (index < total - 1 ? OVERLAP / 2 : 0)
      const center = (start + end) / 2 - along / 2
      const alpha = bend ? center / bend : 0
      const shift = bend ? bend * Math.sin(alpha) : center
      const sink = bend ? bend * (1 - Math.cos(alpha)) : 0
      const depth = layout.inward ? sink : -sink
      const turn = ((layout.inward ? -alpha : alpha) * 180) / Math.PI
      const move =
        axis === 'x'
          ? `translate3d(0px, ${shift}px, ${depth}px) rotateX(${-turn}deg)`
          : `translate3d(${shift}px, 0px, ${depth}px) rotateY(${turn}deg)`
      return { index, total, start, end, size: end - start, move }
    })
  }, [along, axis, curveValue, layout.inward, radius])

  const rootRef = useRef<HTMLDivElement | null>(null)
  const stageRef = useRef<HTMLDivElement | null>(null)
  const cameraRef = useRef<HTMLDivElement | null>(null)
  const ringRef = useRef<HTMLDivElement | null>(null)
  const cardRefs = useRef<(HTMLDivElement | null)[]>([])
  const wakeRef = useRef<() => void>(() => {})
  const measureRef = useRef<() => void>(() => {})
  const activeRef = useRef(0)
  const [active, setActive] = useState(0)
  const [ready, setReady] = useState(false)
  const [dragging, setDragging] = useState(false)
  const readyRef = useRef(false)
  readyRef.current = ready

  const stateRef = useRef<RingState>({
    angle: 0,
    velocity: 0,
    target: null,
    dir: 0,
    press: null,
    drag: false,
    hover: false,
    pointer: { inside: false, x: 0, y: 0 },
    yaw: 0,
    pitch: 0,
    intro: null,
    introDone: false,
    holdUntil: 0,
    stepAt: 0,
    suppressClick: false,
    wheelTimer: 0,
    fit: 1,
    shift: 0,
    drop: 0,
    last: 0,
  })

  const settings = {
    count,
    step,
    radius,
    layout,
    axis,
    tilt: tiltValue,
    perspective: layout.inward ? radius : (perspective ?? layout.perspective),
    cardW,
    cardH,
    intro: (reduced ? 'none' : intro) as Intro,
    autoplay: (reduced ? 'off' : autoplay) as Autoplay,
    speed,
    interval: Math.max(0.5, interval),
    draggable,
    momentum: clamp(momentum, 0, 1),
    snap,
    pauseOnHover,
    parallax: reduced ? 0 : clamp(parallax, 0, 1),
    stretch: reduced ? 0 : clamp(stretch, 0, 1),
    depthFade: clamp(depthFade, 0, 1),
    frontScale: Math.max(1, frontScale),
  }
  const settingsRef = useRef(settings)
  settingsRef.current = settings

  const dragSign = layout.inward ? -1 : 1
  const directionSign = (direction === 'right' ? 1 : -1) * dragSign

  useEffect(() => {
    stateRef.current.dir = directionSign
    wakeRef.current()
  }, [directionSign])

  // The cards come in once the fonts are ready and the ring is first in view, so visitors who
  // scroll down to it see the entrance.
  useEffect(() => {
    const root = rootRef.current
    if (!root) return undefined
    let cancelled = false
    let io: IntersectionObserver | null = null
    document.fonts.ready.then(() => {
      if (cancelled) return
      io = new IntersectionObserver(
        ([entry]) => {
          if (!entry.isIntersecting) return
          const state = stateRef.current
          state.introDone = false
          state.intro = null
          setReady(true)
          io?.disconnect()
        },
        { threshold: 0.25 },
      )
      io.observe(root)
    })
    return () => {
      cancelled = true
      io?.disconnect()
    }
  }, [])

  useLayoutEffect(() => {
    const root = rootRef.current
    const stage = stageRef.current
    const camera = cameraRef.current
    const ring = ringRef.current
    if (!root || !stage || !camera || !ring) return undefined
    const state = stateRef.current
    let raf = 0
    let visible = true

    const nearest = (angle: number) => Math.round(angle / settingsRef.current.step) * settingsRef.current.step

    // Scales the whole ring to fit its box, and centres it.
    const measure = () => {
      const s = settingsRef.current
      const rect = root.getBoundingClientRect()
      if (!rect.width || !rect.height) return
      const width = rect.width * 0.94
      const height = rect.height * 0.92
      const P = s.perspective
      let minX = Infinity
      let maxX = -Infinity
      let minY = Infinity
      let maxY = -Infinity
      if (s.layout.inward) {
        minX = -width / 2
        maxX = width / 2
        minY = -s.cardH / 2
        maxY = s.cardH / 2
      } else {
        const corners: [number, number][] = [
          [-s.cardW / 2, -s.cardH / 2],
          [s.cardW / 2, -s.cardH / 2],
          [-s.cardW / 2, s.cardH / 2],
          [s.cardW / 2, s.cardH / 2],
        ]
        const limit = s.layout.window ? s.layout.window * s.step : 180
        for (let a = -limit; a <= limit; a += limit / 24) {
          for (const [cx, cy] of corners) {
            let p: Point
            if (s.axis === 'x') {
              p = rotateY(rotateX([cx, cy, s.radius], -a), s.tilt)
            } else if (s.layout.billboard) {
              const c = rotateY([0, 0, s.radius], a)
              p = rotateX([c[0] + cx, cy, c[2]], s.tilt)
            } else {
              p = rotateX(rotateY([cx, cy, s.radius], a), s.tilt)
            }
            p = [p[0], p[1], p[2] - s.radius]
            if (p[2] >= P * 0.95) continue
            const k = P / (P - p[2])
            minX = Math.min(minX, p[0] * k)
            maxX = Math.max(maxX, p[0] * k)
            minY = Math.min(minY, p[1] * k)
            maxY = Math.max(maxY, p[1] * k)
          }
        }
      }
      const spanX = Math.max(maxX - minX, 1)
      const spanY = Math.max(maxY - minY, 1)
      const fit = Math.min(1, width / spanX, height / spanY)
      state.fit = fit
      state.shift = -((minY + maxY) / 2) * fit
      state.drop = s.axis === 'x' ? (rect.width / fit) * 0.55 + s.cardW : (rect.height / fit) * 0.55 + s.cardH
      stage.style.perspective = `${P}px`
      stage.style.transform = `translate3d(0, ${state.shift}px, 0) scale(${fit})`
    }
    measureRef.current = measure

    const introCard = (elapsed: number, landing: number) => {
      if (!state.intro) return { radius: 1, lift: 0 }
      const type = state.intro.type
      const reach = Math.abs(wrap(landing + state.angle))
      if (type === 'assemble') {
        const delay = (reach / 180) * 420
        const p = easeOut(clamp((elapsed - delay) / 1080, 0, 1))
        return { radius: 1 + 0.6 * (1 - p), lift: 0 }
      }
      if (type === 'rise') {
        const delay = (reach / 180) * 480
        const p = easeOutQuint(clamp((elapsed - delay) / 900, 0, 1))
        return { radius: 1, lift: (1 - p) * state.drop }
      }
      if (type === 'spin') {
        const p = easeOut(clamp(elapsed / INTRO_LENGTH.spin, 0, 1))
        return { radius: 1 + 0.28 * (1 - p), lift: 0 }
      }
      return { radius: 1, lift: 0 }
    }

    // Moves the ring on by one frame; says whether it still needs more frames.
    const advance = (s: typeof settings, dt: number, now: number) => {
      if (!state.introDone && readyRef.current) {
        if (!state.intro) {
          if (s.intro === 'none') state.introDone = true
          else state.intro = { type: s.intro, start: now }
        }
        if (state.intro && now - state.intro.start >= INTRO_LENGTH[state.intro.type]) {
          state.intro = null
          state.introDone = true
        }
      }

      const paused = (s.pauseOnHover && state.hover) || state.drag || now < state.holdUntil
      const cruise = s.autoplay === 'drift' && !paused && !state.intro ? s.speed * state.dir : 0
      let busy = Boolean(state.intro) || state.drag

      if (state.drag || state.intro) {
        state.velocity = state.drag ? state.velocity : 0
      } else if (state.target !== null) {
        let remaining = dt
        const damping = 2 * Math.sqrt(SPRING)
        while (remaining > 0) {
          const h = Math.min(remaining, 1 / 240)
          const accel = SPRING * (state.target - state.angle) - damping * state.velocity
          state.velocity += accel * h
          state.angle += state.velocity * h
          remaining -= h
        }
        if (Math.abs(state.target - state.angle) < 0.004 && Math.abs(state.velocity) < 0.03) {
          state.angle = state.target
          state.velocity = 0
          state.target = null
        }
        busy = true
      } else {
        const tau = 0.18 + s.momentum * 1.5
        state.velocity += (cruise - state.velocity) * (1 - Math.exp(-dt / tau))
        state.angle += state.velocity * dt
        if (cruise === 0 && s.snap && Math.abs(state.velocity) < SETTLE_SPEED) {
          state.target = nearest(state.angle)
        }
        busy = busy || cruise !== 0 || Math.abs(state.velocity) > 0.01 || state.target !== null
      }

      if (s.autoplay === 'step' && !paused && !state.intro && state.introDone) {
        if (!state.stepAt) state.stepAt = now + s.interval * 1000
        if (now >= state.stepAt) {
          state.target = (state.target ?? nearest(state.angle)) + s.step * state.dir
          state.stepAt = now + s.interval * 1000
        }
        busy = true
      } else {
        state.stepAt = 0
      }

      if (now < state.holdUntil) busy = true

      const ease = 1 - Math.exp(-dt / 0.35)
      const aimYaw = state.pointer.inside ? state.pointer.x * s.parallax * 9 : 0
      const aimPitch = state.pointer.inside ? -state.pointer.y * s.parallax * 6 : 0
      state.yaw += (aimYaw - state.yaw) * ease
      state.pitch += (aimPitch - state.pitch) * ease
      if (Math.abs(aimYaw - state.yaw) > 0.01 || Math.abs(aimPitch - state.pitch) > 0.01) busy = true

      return busy
    }

    const render = (s: typeof settings, now: number) => {
      const elapsed = state.intro ? now - state.intro.start : 0
      const swell = 1 + s.stretch * 0.12 * Math.min(1, Math.abs(state.velocity) / 420)
      let spinOffset = 0
      if (state.intro?.type === 'spin') {
        const p = easeOut(clamp(elapsed / INTRO_LENGTH.spin, 0, 1))
        spinOffset = -300 * state.dir * (1 - p)
      } else if (state.intro?.type === 'assemble') {
        const p = easeOut(clamp(elapsed / INTRO_LENGTH.assemble, 0, 1))
        spinOffset = -32 * state.dir * (1 - p)
      }
      const angle = state.angle + spinOffset
      const R = s.radius * swell

      if (s.axis === 'x') {
        camera.style.transform = `translate3d(0, 0, ${-R}px) rotateY(${s.tilt + state.yaw}deg) rotateX(${state.pitch}deg)`
        ring.style.transform = `rotateX(${-angle}deg)`
      } else if (s.layout.inward) {
        camera.style.transform = `translate3d(0, 0, ${s.perspective - 1}px) rotateX(${s.tilt + state.pitch}deg) rotateY(${state.yaw}deg)`
        ring.style.transform = `rotateY(${angle}deg)`
      } else {
        camera.style.transform = `translate3d(0, 0, ${-R}px) rotateX(${s.tilt + state.pitch}deg) rotateY(${state.yaw}deg)`
        ring.style.transform = `rotateY(${angle}deg)`
      }

      for (let index = 0; index < s.count; index++) {
        const card = cardRefs.current[index]
        if (!card) continue
        const base = index * s.step
        const mod = introCard(elapsed, base)
        const r = R * mod.radius
        let transform: string
        if (s.axis === 'x') {
          transform = `rotateX(${-base}deg) translateZ(${r}px)`
        } else if (s.layout.inward) {
          transform = `rotateY(${base}deg) translateZ(${-r}px)`
        } else {
          transform = `rotateY(${base}deg) translateZ(${r}px)`
          if (s.layout.billboard) transform += ` rotateY(${-(base + angle)}deg)`
        }
        const world = wrap(base + angle)
        const facing = Math.cos(world * TO_RAD)
        // 1 within a few degrees of the front, easing to 0 by about 32 degrees away, so only
        // one card is highlighted at a time.
        const front = clamp((facing - 0.85) / 0.15, 0, 1)

        if (mod.lift) transform += s.axis === 'x' ? ` translateX(${mod.lift}px)` : ` translateY(${mod.lift}px)`
        if (s.frontScale > 1 && front > 0) transform += ` scale(${(1 + (s.frontScale - 1) * front).toFixed(4)})`
        card.style.transform = transform

        if (s.layout.inward) card.style.visibility = Math.abs(world) > 86 ? 'hidden' : ''
        const fade = s.depthFade * Math.pow((1 - facing) / 2, 1.25)
        card.style.setProperty('--cc-depth', fade.toFixed(3))
        card.style.setProperty('--cc-show', clamp((facing - 0.35) / 0.4, 0, 1).toFixed(3))
        card.style.setProperty('--cc-front', front.toFixed(3))
      }

      const index = ((Math.round(-state.angle / s.step) % s.count) + s.count) % s.count || 0
      if (index !== activeRef.current) {
        activeRef.current = index
        setActive(index)
      }
    }

    const frame = (now: number) => {
      raf = 0
      const s = settingsRef.current
      const dt = state.last ? Math.min((now - state.last) / 1000, 0.05) : 1 / 60
      state.last = now
      const busy = advance(s, dt, now)
      render(s, now)
      if (busy && visible && !document.hidden) raf = requestAnimationFrame(frame)
      else state.last = 0
    }

    const wake = () => {
      if (!raf && visible && !document.hidden) raf = requestAnimationFrame(frame)
    }
    wakeRef.current = wake

    const onVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(raf)
        raf = 0
        state.last = 0
      } else wake()
    }

    const resize = new ResizeObserver(() => {
      measure()
      wake()
    })
    resize.observe(root)

    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
      if (visible) wake()
      else {
        cancelAnimationFrame(raf)
        raf = 0
        state.last = 0
      }
    })
    io.observe(root)

    // A sideways trackpad swipe turns the ring; an up and down scroll still scrolls the page.
    const onWheel = (event: WheelEvent) => {
      const s = settingsRef.current
      if (!s.draggable) return
      const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : 0
      if (!delta) return
      event.preventDefault()
      const perPixel = 180 / (Math.PI * s.radius * state.fit)
      state.target = null
      state.angle -= delta * perPixel * (s.layout.inward ? -1 : 1)
      state.velocity = -delta * perPixel * (s.layout.inward ? -1 : 1) * 30
      state.holdUntil = performance.now() + 1600
      window.clearTimeout(state.wheelTimer)
      state.wheelTimer = window.setTimeout(() => {
        if (settingsRef.current.snap) state.target = nearest(state.angle + state.velocity * 0.12)
        wake()
      }, 140)
      wake()
    }
    root.addEventListener('wheel', onWheel, { passive: false })
    document.addEventListener('visibilitychange', onVisibility)

    measure()
    render(settingsRef.current, performance.now())
    wake()

    return () => {
      cancelAnimationFrame(raf)
      resize.disconnect()
      io.disconnect()
      window.clearTimeout(state.wheelTimer)
      root.removeEventListener('wheel', onWheel)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  useLayoutEffect(() => {
    measureRef.current()
    wakeRef.current()
  }, [radius, cardW, cardH, tiltValue, perspective, preset, count])

  useEffect(() => {
    wakeRef.current()
  })

  const focusIndex = useCallback((index: number) => {
    const state = stateRef.current
    const s = settingsRef.current
    let target = -index * s.step
    target += 360 * Math.round((state.angle - target) / 360)
    state.target = target
    state.holdUntil = performance.now() + 2800
    wakeRef.current()
  }, [])

  const stepBy = useCallback((delta: number) => {
    const state = stateRef.current
    const s = settingsRef.current
    const base = state.target ?? Math.round(state.angle / s.step) * s.step
    state.target = base - delta * s.step * (s.layout.inward ? -1 : 1)
    state.holdUntil = performance.now() + 2800
    wakeRef.current()
  }, [])

  const updatePointer = (event: PointerEvent<HTMLDivElement>) => {
    const root = rootRef.current
    if (!root) return
    const rect = root.getBoundingClientRect()
    const pointer = stateRef.current.pointer
    pointer.x = clamp(((event.clientX - rect.left) / rect.width) * 2 - 1, -1, 1)
    pointer.y = clamp(((event.clientY - rect.top) / rect.height) * 2 - 1, -1, 1)
  }

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const state = stateRef.current
    state.suppressClick = false
    if (!draggable || event.button !== 0) return
    state.press = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      angle: state.angle,
      moved: false,
      origin: 0,
      samples: [{ time: performance.now(), angle: state.angle }],
    }
  }

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const state = stateRef.current
    if (event.pointerType === 'mouse') {
      state.pointer.inside = true
      updatePointer(event)
    }
    const press = state.press
    if (!press || press.id !== event.pointerId) {
      wakeRef.current()
      return
    }
    const s = settingsRef.current
    const delta = s.axis === 'x' ? event.clientY - press.y : event.clientX - press.x
    const cross = s.axis === 'x' ? event.clientX - press.x : event.clientY - press.y
    if (!press.moved) {
      if (Math.abs(delta) < DRAG_THRESHOLD) return
      if (Math.abs(cross) > Math.abs(delta) * 1.2 && event.pointerType !== 'mouse') {
        state.press = null
        return
      }
      press.moved = true
      press.origin = delta
      state.drag = true
      state.target = null
      state.velocity = 0
      setDragging(true)
      try {
        rootRef.current?.setPointerCapture(event.pointerId)
      } catch {
        // The pointer may already be gone; dragging still works without capture.
      }
    }
    const perPixel = 180 / (Math.PI * s.radius * state.fit)
    state.angle = press.angle + (delta - press.origin) * perPixel * (s.layout.inward ? -1 : 1)
    const now = performance.now()
    press.samples.push({ time: now, angle: state.angle })
    while (press.samples.length > 2 && now - press.samples[0].time > 110) press.samples.shift()
    wakeRef.current()
  }

  const releasePointer = (event: PointerEvent<HTMLDivElement>) => {
    const state = stateRef.current
    const press = state.press
    if (!press || press.id !== event.pointerId) return
    state.press = null
    if (!press.moved) return
    state.drag = false
    setDragging(false)
    state.suppressClick = true
    const s = settingsRef.current
    const first = press.samples[0]
    const last = press.samples[press.samples.length - 1]
    const span = (last.time - first.time) / 1000
    const velocity = span > 0.008 ? clamp((last.angle - first.angle) / span, -1400, 1400) : 0
    state.velocity = velocity
    if (Math.abs(velocity) > 60) state.dir = Math.sign(velocity)
    const coasting = s.autoplay === 'drift' && !(s.pauseOnHover && state.hover && event.pointerType === 'mouse')
    if (s.snap && !coasting) {
      const tau = 0.18 + s.momentum * 1.5
      state.target = Math.round((state.angle + velocity * tau * 0.55) / s.step) * s.step
    }
    wakeRef.current()
  }

  const handlePointerEnter = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'mouse') return
    stateRef.current.hover = true
    wakeRef.current()
  }

  const handlePointerLeave = (event: PointerEvent<HTMLDivElement>) => {
    const state = stateRef.current
    if (event.pointerType === 'mouse') {
      state.hover = false
      state.pointer.inside = false
    }
    wakeRef.current()
  }

  const handleClick = (event: MouseEvent<HTMLDivElement>) => {
    const state = stateRef.current
    if (state.suppressClick) {
      state.suppressClick = false
      return
    }
    const card = (event.target as Element).closest?.('[data-cc-index]')
    if (!card) return
    if (focusOnClick) focusIndex(Number(card.getAttribute('data-cc-index')))
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const forward = axis === 'x' ? 'ArrowDown' : 'ArrowRight'
    const backward = axis === 'x' ? 'ArrowUp' : 'ArrowLeft'
    if (event.key === forward) stepBy(1)
    else if (event.key === backward) stepBy(-1)
    else if (event.key === 'Home') focusIndex(0)
    else if (event.key === 'End') focusIndex(count - 1)
    else return
    event.preventDefault()
  }

  const renderTile = (item: CarouselItem, tile: Tile, back: boolean) => {
    const strip = back ? tile.total - 1 - tile.index : tile.index
    const first = strip === 0
    const last = strip === tile.total - 1
    const r = 'var(--cc-radius)'
    const frameRadius =
      axis === 'x'
        ? `${first ? r : 0} ${first ? r : 0} ${last ? r : 0} ${last ? r : 0}`
        : `${first ? r : 0} ${last ? r : 0} ${last ? r : 0} ${first ? r : 0}`
    const offset = back ? along - tile.end : tile.start
    const size = tile.size
    const box =
      axis === 'x'
        ? { left: -cardW / 2, top: -size / 2, width: cardW, height: size }
        : { left: -size / 2, top: -cardH / 2, width: size, height: cardH }
    const faceStyle =
      axis === 'x'
        ? { left: 0, top: -offset, width: cardW, height: cardH }
        : { left: -offset, top: 0, width: cardW, height: cardH }
    const flip = axis === 'x' ? ' rotateX(180deg)' : ' rotateY(180deg)'
    return (
      <div
        key={`${back ? 'b' : 'f'}${tile.index}`}
        className="circular-carousel__tile"
        style={{ ...box, transform: tile.move + (back ? flip : '') }}
        aria-hidden="true"
      >
        <div className="circular-carousel__frame" style={{ height: axis === 'x' ? size : cardH, borderRadius: frameRadius }}>
          <div className="circular-carousel__face" style={faceStyle}>
            {item.content}
          </div>
          {back && <div className="circular-carousel__inner" />}
          <div className="circular-carousel__shade" />
        </div>
      </div>
    )
  }

  const current = items[active] ?? items[0]

  return (
    <div
      ref={rootRef}
      className={`circular-carousel ${className}`.trim()}
      style={
        {
          ...style,
          '--cc-fade': fadeColor,
          '--cc-radius': `${Math.max(0, cornerRadius)}px`,
          '--cc-inner': (1 - clamp(innerShade, 0, 1)).toFixed(3),
        } as CSSProperties
      }
      role="region"
      aria-roledescription="carousel"
      aria-label={ariaLabel}
      tabIndex={0}
      data-axis={axis}
      data-shape={preset}
      data-ready={ready ? '' : undefined}
      data-draggable={draggable ? '' : undefined}
      data-dragging={dragging ? '' : undefined}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={releasePointer}
      onPointerCancel={releasePointer}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      <div className="circular-carousel__view">
        <div ref={stageRef} className="circular-carousel__stage">
          <div ref={cameraRef} className="circular-carousel__camera">
            <div ref={ringRef} className="circular-carousel__ring">
              {items.map((item, index) => (
                <div
                  key={item.id}
                  ref={(element) => {
                    cardRefs.current[index] = element
                  }}
                  className="circular-carousel__card"
                  data-cc-index={index}
                  role="group"
                  aria-roledescription="slide"
                  aria-label={`${item.label}, ${index + 1} of ${count}`}
                >
                  {tiles.map((tile) => renderTile(item, tile, false))}
                  {layout.backfaces && tiles.map((tile) => renderTile(item, tile, true))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="circular-carousel__live" aria-live="polite" aria-atomic="true">
        {current ? `${current.label}, ${active + 1} of ${count}` : ''}
      </div>
    </div>
  )
}
