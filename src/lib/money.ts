// Money travels as whole paise (₹1 = 100 paise) and is only turned into rupees for display.

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2, minimumFractionDigits: 0 })

/** 650000 paise gives "₹6,500"; 650050 gives "₹6,500.5". */
export function formatINR(paise: number): string {
  return inr.format(paise / 100)
}

/** "6500" or "6500.50" typed in a form, as paise. Returns null for anything that is not an amount. */
export function rupeesToPaise(value: string): number | null {
  const cleaned = value.replace(/[,\s₹]/g, '')
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null
  const [whole, fraction = ''] = cleaned.split('.')
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
}

/** 650000 paise as "6500" for an input box (no symbol, no commas). */
export function paiseToRupeesInput(paise: number): string {
  return paise % 100 === 0 ? String(paise / 100) : (paise / 100).toFixed(2)
}
