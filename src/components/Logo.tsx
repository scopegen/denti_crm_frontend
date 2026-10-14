// Denti's logo, made from the shield and wordmark in public/: the full logo (shield above
// "denti") for sign in and sign up pages, the shield and word side by side for page headers,
// and the shield alone for the app's top bar.

export function LogoStacked({ className = 'h-20' }: { className?: string }) {
  return <img src="/logo.png" alt="Denti" width={320} height={315} className={`w-auto ${className}`} />
}

export function LogoWide({ className = 'h-10' }: { className?: string }) {
  return (
    <span className={`flex items-center gap-2 ${className}`} role="img" aria-label="Denti">
      <img src="/logo-mark.png" alt="" width={128} height={128} className="h-full w-auto" />
      <img src="/logo-word.png" alt="" width={360} height={107} className="h-[62%] w-auto" />
    </span>
  )
}

export function LogoMark({ className = 'h-8' }: { className?: string }) {
  return <img src="/logo-mark.png" alt="Denti" width={128} height={128} className={`w-auto ${className}`} />
}
