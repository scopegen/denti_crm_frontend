/**
 * Every clinic lives under its own name in the web address, the same shape for every clinic:
 *   denti.in/smile-dental            sign in
 *   denti.in/smile-dental/today      the Today page
 *   denti.in/smile-dental/patients   patients
 */
export function clinicPath(slug: string, page = ''): string {
  return page ? `/${slug}/${page}` : `/${slug}`
}

/** Lowercase letters, numbers and single hyphens between them, as the database allows. */
export function isValidClinicSlug(value: string): boolean {
  return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(value)
}
