// Ranco's light blue gradient with two soft waves along the bottom, used behind the patient
// card and the patient form. Colours come from theme tokens.
export function Waves({ tall = false }: { tall?: boolean }) {
  return (
    <>
      <svg
        className={`pointer-events-none absolute inset-x-0 bottom-0 w-full text-wave-light/70 ${tall ? 'h-40 sm:h-56' : 'h-20 sm:h-28'}`}
        viewBox="0 0 800 120"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path d="M0,80 C150,20 350,120 550,60 C650,30 750,70 800,50 L800,120 L0,120 Z" fill="currentColor" />
      </svg>
      <svg
        className={`pointer-events-none absolute inset-x-0 bottom-0 w-full text-wave-deep/60 ${tall ? 'h-28 sm:h-40' : 'h-14 sm:h-20'}`}
        viewBox="0 0 800 90"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path d="M0,60 C200,10 400,90 600,40 C700,15 750,50 800,35 L800,90 L0,90 Z" fill="currentColor" />
      </svg>
    </>
  )
}
