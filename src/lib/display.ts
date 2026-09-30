/**
 * Denti never shows a dash for a missing value (docs/frontend-rules.md). Pass words that
 * fit the field when "Not added" does not, for example orWords(doctor, 'No doctor assigned').
 */
export function orWords(value: string | null | undefined, words = 'Not added'): string {
  return value != null && value.trim() !== '' ? value : words
}
