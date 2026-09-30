/** Age in whole years from a full date of birth, or from a birth year when that is all we have. */
export function calculateAge(dob: string | null | undefined, birthYear?: number | null): number | null {
  const today = new Date()
  if (dob) {
    const [year, month, day] = dob.slice(0, 10).split('-').map(Number)
    if (!year || !month || !day) return null
    let age = today.getFullYear() - year
    const beforeBirthday = today.getMonth() + 1 < month || (today.getMonth() + 1 === month && today.getDate() < day)
    if (beforeBirthday) age -= 1
    return age >= 0 ? age : null
  }
  if (birthYear) {
    const age = today.getFullYear() - birthYear
    return age >= 0 ? age : null
  }
  return null
}
