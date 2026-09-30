// Teeth in FDI numbering, the way the server stores them: adult 11 to 48, milk 51 to 85.
// Universal numbering (1 to 32, A to T) is only a different label on the same teeth.

export type Dentition = 'adult' | 'child'
export type Numbering = 'fdi' | 'universal'
export type ToothType = 'central' | 'lateral' | 'canine' | 'premolar' | 'molar'

export function isMilkTooth(tooth: number): boolean {
  return tooth >= 51
}

export function toothType(tooth: number): ToothType {
  const position = tooth % 10
  if (position === 1) return 'central'
  if (position === 2) return 'lateral'
  if (position === 3) return 'canine'
  if (!isMilkTooth(tooth) && position <= 5) return 'premolar'
  return 'molar'
}

/** The two rows as seen facing the patient: the patient's right on the left of the screen. */
export function chartRows(dentition: Dentition): { upper: number[]; lower: number[] } {
  const count = dentition === 'adult' ? 8 : 5
  const [upperRight, upperLeft, lowerLeft, lowerRight] = dentition === 'adult' ? [1, 2, 3, 4] : [5, 6, 7, 8]
  const towardsMiddle = Array.from({ length: count }, (_, i) => count - i)
  const awayFromMiddle = Array.from({ length: count }, (_, i) => i + 1)
  return {
    upper: [...towardsMiddle.map((p) => upperRight * 10 + p), ...awayFromMiddle.map((p) => upperLeft * 10 + p)],
    lower: [...towardsMiddle.map((p) => lowerRight * 10 + p), ...awayFromMiddle.map((p) => lowerLeft * 10 + p)],
  }
}

/** "36" in FDI, "19" in Universal; milk teeth are letters in Universal. */
export function toothLabel(tooth: number, numbering: Numbering): string {
  if (numbering === 'fdi') return String(tooth)
  const quadrant = Math.floor(tooth / 10)
  const position = tooth % 10
  if (quadrant <= 4) {
    const n = quadrant === 1 ? 9 - position : quadrant === 2 ? 8 + position : quadrant === 3 ? 25 - position : 24 + position
    return String(n)
  }
  const index = quadrant === 5 ? 5 - position : quadrant === 6 ? 4 + position : quadrant === 7 ? 15 - position : 14 + position
  return 'ABCDEFGHIJKLMNOPQRST'[index]
}

const SIDES: Record<number, string> = {
  1: 'Upper right', 2: 'Upper left', 3: 'Lower left', 4: 'Lower right',
  5: 'Upper right', 6: 'Upper left', 7: 'Lower left', 8: 'Lower right',
}
const ADULT_NAMES: Record<number, string> = {
  1: 'central incisor', 2: 'lateral incisor', 3: 'canine', 4: 'first premolar',
  5: 'second premolar', 6: 'first molar', 7: 'second molar', 8: 'wisdom tooth',
}
const MILK_NAMES: Record<number, string> = { 1: 'central incisor', 2: 'lateral incisor', 3: 'canine', 4: 'first molar', 5: 'second molar' }

/** "Lower left first molar", "Upper right canine (milk)". */
export function toothName(tooth: number): string {
  const quadrant = Math.floor(tooth / 10)
  const position = tooth % 10
  const names = isMilkTooth(tooth) ? MILK_NAMES : ADULT_NAMES
  return `${SIDES[quadrant]} ${names[position]}${isMilkTooth(tooth) ? ' (milk)' : ''}`
}
