import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { gsap } from 'gsap'
import './PillNav.css'

// PillNav from React Bits (reactbits.dev), typed and fitted to Denti: centred at the top of the
// page in the theme's colours, with the logo before or after the pills. Hovering a pill rolls its
// label up and a copy in from below; on phones the pills fold into a menu behind a button.

export interface PillNavItem {
  label: string
  href: string
  ariaLabel?: string
}

interface PillNavProps {
  logo: string
  logoAlt?: string
  /** Keep this array outside the component that renders the nav: a new array on every render
   * replays the opening animation. */
  items: PillNavItem[]
  activeHref?: string
  className?: string
  /** A GSAP ease, such as power3.easeOut. */
  ease?: string
  baseColor?: string
  pillColor?: string
  hoveredPillTextColor?: string
  pillTextColor?: string
  /** Behind a link in the phone menu on hover; the bar's colour unless set. */
  hoverColor?: string
  /** Behind the logo; the bar's colour unless set. */
  logoBackground?: string
  /** Which side of the pills the logo sits on. */
  logoSide?: 'left' | 'right'
  onMobileMenuClick?: () => void
  initialLoadAnimation?: boolean
}

const isExternalLink = (href: string) =>
  href.startsWith('http://') ||
  href.startsWith('https://') ||
  href.startsWith('//') ||
  href.startsWith('mailto:') ||
  href.startsWith('tel:') ||
  href.startsWith('#')

const isRouterLink = (href: string | undefined): href is string => !!href && !isExternalLink(href)

export function PillNav({
  logo,
  logoAlt = 'Logo',
  items,
  activeHref,
  className = '',
  ease = 'power3.easeOut',
  baseColor = '#fff',
  pillColor = '#120F17',
  hoveredPillTextColor = '#120F17',
  pillTextColor,
  hoverColor,
  logoBackground,
  logoSide = 'left',
  onMobileMenuClick,
  initialLoadAnimation = true,
}: PillNavProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const pillRefs = useRef<(HTMLAnchorElement | null)[]>([])
  const tlRefs = useRef<(gsap.core.Timeline | undefined)[]>([])
  const activeTweenRefs = useRef<(gsap.core.Tween | undefined)[]>([])
  const logoImgRef = useRef<HTMLImageElement | null>(null)
  const logoTweenRef = useRef<gsap.core.Tween | null>(null)
  const hamburgerRef = useRef<HTMLButtonElement | null>(null)
  const mobileMenuRef = useRef<HTMLDivElement | null>(null)
  const navItemsRef = useRef<HTMLDivElement | null>(null)
  const logoRef = useRef<HTMLAnchorElement | null>(null)

  useEffect(() => {
    // Each pill gets a paused timeline that hovering plays forwards and leaving plays back: the
    // label rolls up out of the pill while its copy rolls in from below.
    const layout = () => {
      pillRefs.current.forEach((pill, index) => {
        if (!pill) return
        const { height: h } = pill.getBoundingClientRect()
        const label = pill.querySelector('.pill-label')
        const hoverLabel = pill.querySelector('.pill-label-hover')
        if (label) gsap.set(label, { y: 0 })
        if (hoverLabel) gsap.set(hoverLabel, { y: Math.ceil(h + 100), opacity: 0 })

        tlRefs.current[index]?.kill()
        const tl = gsap.timeline({ paused: true })
        if (label) tl.to(label, { y: -(h + 8), duration: 2, ease, overwrite: 'auto' }, 0)
        if (hoverLabel) tl.to(hoverLabel, { y: 0, opacity: 1, duration: 2, ease, overwrite: 'auto' }, 0)
        tlRefs.current[index] = tl
      })
    }

    layout()
    window.addEventListener('resize', layout)
    document.fonts?.ready.then(layout).catch(() => {})

    if (mobileMenuRef.current) gsap.set(mobileMenuRef.current, { visibility: 'hidden', opacity: 0, scaleY: 1 })

    const logoEl = logoRef.current
    const navItems = navItemsRef.current
    if (initialLoadAnimation) {
      if (logoEl) {
        gsap.set(logoEl, { scale: 0 })
        gsap.to(logoEl, { scale: 1, duration: 0.6, ease })
      }
      if (navItems) {
        gsap.set(navItems, { width: 0, overflow: 'hidden' })
        // The pills get their natural width back afterwards, so a font that loads late or a
        // longer label is never cut off.
        gsap.to(navItems, {
          width: 'auto',
          duration: 0.6,
          ease,
          onComplete: () => {
            gsap.set(navItems, { clearProps: 'width,overflow' })
          },
        })
      }
    }

    const timelines = tlRefs.current
    return () => {
      window.removeEventListener('resize', layout)
      timelines.forEach((tl) => tl?.kill())
      const intro = [logoEl, navItems].filter((el) => el !== null)
      gsap.killTweensOf(intro)
      gsap.set(intro, { clearProps: 'transform,width,overflow' })
    }
  }, [items, ease, initialLoadAnimation])

  const handleEnter = (i: number) => {
    const tl = tlRefs.current[i]
    if (!tl) return
    activeTweenRefs.current[i]?.kill()
    activeTweenRefs.current[i] = tl.tweenTo(tl.duration(), { duration: 0.3, ease, overwrite: 'auto' })
  }

  const handleLeave = (i: number) => {
    const tl = tlRefs.current[i]
    if (!tl) return
    activeTweenRefs.current[i]?.kill()
    activeTweenRefs.current[i] = tl.tweenTo(0, { duration: 0.2, ease, overwrite: 'auto' })
  }

  const handleLogoEnter = () => {
    const img = logoImgRef.current
    if (!img) return
    logoTweenRef.current?.kill()
    gsap.set(img, { rotate: 0 })
    logoTweenRef.current = gsap.to(img, { rotate: 360, duration: 0.2, ease, overwrite: 'auto' })
  }

  // Opens or closes the phone menu with its animation. Choosing a link closes it too, so a
  // link to a section further down the same page does not leave the menu covering it.
  const setMobileMenu = (open: boolean) => {
    setIsMobileMenuOpen(open)

    const lines = hamburgerRef.current?.querySelectorAll('.hamburger-line')
    if (lines && lines.length === 2) {
      gsap.to(lines[0], { rotation: open ? 45 : 0, y: open ? 3 : 0, duration: 0.3, ease })
      gsap.to(lines[1], { rotation: open ? -45 : 0, y: open ? -3 : 0, duration: 0.3, ease })
    }

    const menu = mobileMenuRef.current
    if (menu) {
      if (open) {
        gsap.set(menu, { visibility: 'visible' })
        gsap.fromTo(
          menu,
          { opacity: 0, y: 10, scaleY: 1 },
          { opacity: 1, y: 0, scaleY: 1, duration: 0.3, ease, transformOrigin: 'top center' },
        )
      } else {
        gsap.to(menu, {
          opacity: 0,
          y: 10,
          scaleY: 1,
          duration: 0.2,
          ease,
          transformOrigin: 'top center',
          onComplete: () => {
            gsap.set(menu, { visibility: 'hidden' })
          },
        })
      }
    }
  }

  const toggleMobileMenu = () => {
    setMobileMenu(!isMobileMenuOpen)
    onMobileMenuClick?.()
  }

  const cssVars = {
    '--base': baseColor,
    '--pill-bg': pillColor,
    '--hover-text': hoveredPillTextColor,
    '--pill-text': pillTextColor ?? baseColor,
    '--hover-bg': hoverColor ?? baseColor,
    '--logo-bg': logoBackground ?? baseColor,
  } as CSSProperties

  const pillContent = (item: PillNavItem) => (
    <span className="label-stack">
      <span className="pill-label">{item.label}</span>
      <span className="pill-label-hover" aria-hidden="true">
        {item.label}
      </span>
    </span>
  )

  const logoImage = <img src={logo} alt={logoAlt} ref={logoImgRef} />
  const homeHref = items[0]?.href
  // The logo comes first or last in the page itself too, so the Tab key follows what is seen.
  const logoLink = isRouterLink(homeHref) ? (
    <Link className="pill-logo" to={homeHref} aria-label="Home" onMouseEnter={handleLogoEnter} ref={logoRef}>
      {logoImage}
    </Link>
  ) : (
    <a className="pill-logo" href={homeHref || '#'} aria-label="Home" onMouseEnter={handleLogoEnter} ref={logoRef}>
      {logoImage}
    </a>
  )

  return (
    <div className="pill-nav-container">
      <nav className={`pill-nav ${className}`} aria-label="Primary" style={cssVars}>
        {logoSide === 'left' && logoLink}

        <div className="pill-nav-items desktop-only" ref={navItemsRef}>
          <ul className="pill-list">
            {items.map((item, i) => {
              const props = {
                className: `pill${activeHref === item.href ? ' is-active' : ''}`,
                'aria-label': item.ariaLabel || item.label,
                'aria-current': activeHref === item.href ? ('page' as const) : undefined,
                onMouseEnter: () => handleEnter(i),
                onMouseLeave: () => handleLeave(i),
                onFocus: () => handleEnter(i),
                onBlur: () => handleLeave(i),
                ref: (el: HTMLAnchorElement | null) => {
                  pillRefs.current[i] = el
                },
              }
              return (
                <li key={item.href || `item-${i}`}>
                  {isRouterLink(item.href) ? (
                    <Link to={item.href} {...props}>
                      {pillContent(item)}
                    </Link>
                  ) : (
                    <a href={item.href} {...props}>
                      {pillContent(item)}
                    </a>
                  )}
                </li>
              )
            })}
          </ul>
        </div>

        <button
          type="button"
          className="mobile-menu-button mobile-only"
          onClick={toggleMobileMenu}
          aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={isMobileMenuOpen}
          ref={hamburgerRef}
        >
          <span className="hamburger-line" />
          <span className="hamburger-line" />
        </button>

        {logoSide === 'right' && logoLink}
      </nav>

      <div className="mobile-menu-popover mobile-only" ref={mobileMenuRef} style={cssVars}>
        <ul className="mobile-menu-list">
          {items.map((item, i) => {
            const className = `mobile-menu-link${activeHref === item.href ? ' is-active' : ''}`
            return (
              <li key={item.href || `mobile-item-${i}`}>
                {isRouterLink(item.href) ? (
                  <Link to={item.href} className={className} onClick={() => setMobileMenu(false)}>
                    {item.label}
                  </Link>
                ) : (
                  <a href={item.href} className={className} onClick={() => setMobileMenu(false)}>
                    {item.label}
                  </a>
                )}
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
